'use strict';
import { Functions } from '../system';
import { ConfigurationChangeEvent, Disposable, Event, EventEmitter, TextDocumentChangeEvent, TextEditor, window, workspace } from 'vscode';
import { TextDocumentComparer } from '../comparers';
import { configuration } from '../configuration';
import { CommandContext, isTextEditor, setCommandContext } from '../constants';
import { GitChangeEvent, GitChangeReason, GitService, GitUri, Repository, RepositoryChangeEvent } from '../gitService';
// import { Logger } from '../logger';

export enum BlameabilityChangeReason {
    BlameFailed = 'blame-failed',
    DocumentChanged = 'document-changed',
    EditorChanged = 'editor-changed',
    RepoChanged = 'repo-changed'
}

export interface BlameabilityChangeEvent {
    blameable: boolean;
    editor: TextEditor | undefined;
    reason: BlameabilityChangeReason;
}

interface Context {
    editor?: TextEditor;
    repo?: Repository;
    repoDisposable?: Disposable;
    state: ContextState;
    uri?: GitUri;
}

interface ContextState {
    blameable?: boolean;
    dirty: boolean;
    tracked?: boolean;
}

export class GitContextTracker extends Disposable {

    private _onDidChangeBlameability = new EventEmitter<BlameabilityChangeEvent>();
    get onDidChangeBlameability(): Event<BlameabilityChangeEvent> {
        return this._onDidChangeBlameability.event;
    }

    private readonly _context: Context = { state: { dirty: false } };
    private readonly _disposable: Disposable;
    private _listenersDisposable: Disposable | undefined;

    constructor(
        private readonly git: GitService
    ) {
        super(() => this.dispose());

        this._disposable = Disposable.from(
            workspace.onDidChangeConfiguration(this.onConfigurationChanged, this)
        );
    this.onConfigurationChanged(configuration.initializingChangeEvent);
    }

    dispose() {
        this._listenersDisposable && this._listenersDisposable.dispose();
        this._disposable && this._disposable.dispose();
    }

    private onConfigurationChanged(e: ConfigurationChangeEvent) {
        if (!configuration.initializing(e) && !e.affectsConfiguration('git.enabled', null!)) return;

        const enabled = workspace.getConfiguration('git', null!).get<boolean>('enabled', true);
        if (this._listenersDisposable !== undefined) {
            this._listenersDisposable.dispose();
            this._listenersDisposable = undefined;
        }

        setCommandContext(CommandContext.Enabled, enabled);

        if (enabled) {
            this._listenersDisposable = Disposable.from(
                window.onDidChangeActiveTextEditor(Functions.debounce(this.onActiveTextEditorChanged, 50), this),
                workspace.onDidChangeTextDocument(Functions.debounce(this.onTextDocumentChanged, 50), this),
                this.git.onDidBlameFail(this.onBlameFailed, this),
                this.git.onDidChange(this.onGitChanged, this)
            );

            this.updateContext(BlameabilityChangeReason.EditorChanged, window.activeTextEditor, true);
        }
        else {
            this.updateContext(BlameabilityChangeReason.EditorChanged, window.activeTextEditor, false);
        }
    }

    private onActiveTextEditorChanged(editor: TextEditor | undefined) {
        if (editor === this._context.editor) return;
        if (editor !== undefined && !isTextEditor(editor)) return;

        // Logger.log('GitContextTracker.onActiveTextEditorChanged', editor && editor.document.uri.fsPath);

        this.updateContext(BlameabilityChangeReason.EditorChanged, editor, true);
    }

    private onBlameFailed(key: string) {
        if (this._context.editor === undefined || key !== this.git.getCacheEntryKey(this._context.editor.document.uri)) return;

        this.updateBlameability(BlameabilityChangeReason.BlameFailed, false);
    }

    private onGitChanged(e: GitChangeEvent) {
        if (e.reason !== GitChangeReason.Repositories) return;

        this.updateRemotes();
    }

    private onRepoChanged(e: RepositoryChangeEvent) {
        this.updateContext(BlameabilityChangeReason.RepoChanged, this._context.editor);
        this.updateRemotes();
    }

    private onTextDocumentChanged(e: TextDocumentChangeEvent) {
        if (this._context.editor === undefined || !TextDocumentComparer.equals(this._context.editor.document, e.document)) return;

        // If we haven't changed state, kick out
        if (this._context.state.dirty === e.document.isDirty) return;

        // Logger.log('GitContextTracker.onTextDocumentChanged', 'Dirty state changed', e);

        this._context.state.dirty = e.document.isDirty;
        this.updateBlameability(BlameabilityChangeReason.DocumentChanged);
    }

    private async updateContext(reason: BlameabilityChangeReason, editor: TextEditor | undefined, force: boolean = false) {
        let tracked: boolean;
        if (force || this._context.editor !== editor) {
            this._context.editor = editor;
            this._context.repo = undefined;
            if (this._context.repoDisposable !== undefined) {
                this._context.repoDisposable.dispose();
                this._context.repoDisposable = undefined;
            }

            if (editor !== undefined) {
                const uri = editor.document.uri;

                const repo = await this.git.getRepository(uri);
                if (repo !== undefined) {
                    this._context.repo = repo;
                    this._context.repoDisposable = repo.onDidChange(this.onRepoChanged, this);
                }

                this._context.uri = await GitUri.fromUri(uri, this.git);
                this._context.state.dirty = editor.document.isDirty;
                tracked = await this.git.isTracked(this._context.uri);
            }
            else {
                this._context.uri = undefined;
                this._context.state.dirty = false;
                this._context.state.blameable = false;
                tracked = false;
            }
        }
        else {
            // Since the tracked state could have changed, update it
            tracked = this._context.uri !== undefined
                ? await this.git.isTracked(this._context.uri!)
                : false;
        }

        if (this._context.state.tracked !== tracked) {
            this._context.state.tracked = tracked;
            setCommandContext(CommandContext.ActiveFileIsTracked, tracked);
        }

        this.updateBlameability(reason, undefined, force);
        this.updateRemotes();
    }

    private updateBlameability(reason: BlameabilityChangeReason, blameable?: boolean, force: boolean = false) {
        if (blameable === undefined) {
            blameable = this._context.state.tracked && !this._context.state.dirty;
        }

        if (!force && this._context.state.blameable === blameable) return;

        this._context.state.blameable = blameable;

        setCommandContext(CommandContext.ActiveIsBlameable, blameable);
        this._onDidChangeBlameability.fire({
            blameable: blameable!,
            editor: this._context && this._context.editor,
            reason: reason
        });
    }

    private async updateRemotes() {
        let hasRemotes = false;
        if (this._context.repo !== undefined) {
            hasRemotes = await this._context.repo.hasRemotes();
            setCommandContext(CommandContext.ActiveHasRemotes, hasRemotes);
        }
        else {
            setCommandContext(CommandContext.ActiveHasRemotes, false);
        }

        if (!hasRemotes) {
            const repositories = await this.git.getRepositories();
            for (const repo of repositories) {
                if (repo === this._context.repo) continue;

                hasRemotes = await repo.hasRemotes();
                if (hasRemotes) break;
            }
        }

        setCommandContext(CommandContext.HasRemotes, hasRemotes);
    }
}