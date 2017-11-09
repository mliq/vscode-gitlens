'use strict';
import { Iterables } from '../system';
import { Disposable, TreeItem, TreeItemCollapsibleState } from 'vscode';
import { CommitFileNode, CommitFileNodeDisplayAs } from './commitFileNode';
import { ExplorerNode, MessageNode, ResourceType } from './explorerNode';
import { GitCommitType, GitLogCommit, GitService, GitUri, Repository, RepositoryChange, RepositoryChangeEvent } from '../gitService';
import { GitExplorer } from './gitExplorer';
import { Logger } from '../logger';

export class FileHistoryNode extends ExplorerNode {

    constructor(
        uri: GitUri,
        private readonly repo: Repository,
        private readonly explorer: GitExplorer
    ) {
        super(uri);
    }

    async getChildren(): Promise<ExplorerNode[]> {
        this.updateSubscription();

        const children: ExplorerNode[] = [];

        const log = await this.explorer.git.getLogForFile(this.uri.repoPath, this.uri.fsPath, this.uri.sha);
        if (log === undefined) return [new MessageNode('No file history')];

        if (this.explorer.git.isFileUncommitted(this.uri)) {
            const status = await this.explorer.git.getStatusForFile(this.uri.repoPath!, this.uri.fsPath);
            if (status !== undefined && status.indexStatus === 'M') {
                const commit = new GitLogCommit(
                    GitCommitType.File,
                    this.uri.repoPath!,
                    GitService.stagedUncommittedSha,
                    status.fileName,
                    'You',
                    new Date(),
                    '',
                    status.status,
                    [status],
                    status.originalFileName,
                    'HEAD',
                    status.originalFileName || status.fileName);
                children.push(new CommitFileNode(status, commit, this.explorer, CommitFileNodeDisplayAs.CommitLabel | CommitFileNodeDisplayAs.StatusIcon));
            }
        }

        children.push(...Iterables.map(log.commits.values(), c => new CommitFileNode(c.fileStatuses[0], c, this.explorer, CommitFileNodeDisplayAs.CommitLabel | CommitFileNodeDisplayAs.StatusIcon)));

        return children;
    }

    getTreeItem(): TreeItem {
        this.updateSubscription();

        const item = new TreeItem(`${this.uri.getFormattedPath()}`, TreeItemCollapsibleState.Expanded);
        item.contextValue = ResourceType.FileHistory;

        item.iconPath = {
            dark: this.explorer.context.asAbsolutePath('images/dark/icon-history.svg'),
            light: this.explorer.context.asAbsolutePath('images/light/icon-history.svg')
        };

        return item;
    }

    private updateSubscription() {
        // We only need to subscribe if auto-refresh is enabled, because if it becomes enabled we will be refreshed
        if (this.explorer.autoRefresh) {
            this.disposable = this.disposable || Disposable.from(
                this.explorer.onDidChangeAutoRefresh(this.onAutoRefreshChanged, this),
                this.repo.onDidChange(this.onRepoChanged, this)
            );
        }
        else if (this.disposable !== undefined) {
            this.disposable.dispose();
            this.disposable = undefined;
        }
    }

    private onAutoRefreshChanged() {
        this.updateSubscription();
    }

    private onRepoChanged(e: RepositoryChangeEvent) {
        if (e.changed(RepositoryChange.Stashes, true)) return;

        Logger.log(`RepositoryNode.onRepoChanged(${e.changes.join()}); triggering node refresh`);

        this.explorer.refreshNode(this);
    }
}