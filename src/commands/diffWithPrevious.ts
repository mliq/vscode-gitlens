'use strict';
import { Iterables } from '../system';
import { commands, Range, TextDocumentShowOptions, TextEditor, Uri, window } from 'vscode';
import { ActiveEditorCommand, Commands, getCommandUri } from './common';
import { DiffWithCommandArgs } from './diffWith';
import { DiffWithWorkingCommandArgs } from './diffWithWorking';
import { GitCommit, GitCommitType, GitService, GitUri } from '../gitService';
import { Logger } from '../logger';
import { Messages } from '../messages';

export interface DiffWithPreviousCommandArgs {
    commit?: GitCommit;
    range?: Range;

    line?: number;
    showOptions?: TextDocumentShowOptions;
}

export class DiffWithPreviousCommand extends ActiveEditorCommand {

    constructor(
        private readonly git: GitService
    ) {
        super(Commands.DiffWithPrevious);
    }

    async execute(editor?: TextEditor, uri?: Uri, args: DiffWithPreviousCommandArgs = {}): Promise<any> {
        uri = getCommandUri(uri, editor);
        if (uri === undefined) return undefined;

        args = { ...args };
        if (args.line === undefined) {
            args.line = editor === undefined ? 0 : editor.selection.active.line;
        }

        if (args.commit === undefined || args.commit.type !== GitCommitType.File || args.range !== undefined) {
            const gitUri = await GitUri.fromUri(uri, this.git);

            try {
                let sha = args.commit === undefined ? gitUri.sha : args.commit.sha;
                if (sha === GitService.deletedSha) return Messages.showCommitHasNoPreviousCommitWarningMessage();

                // If we are a fake "staged" sha, remove it
                let isStagedUncommitted = false;
                if (GitService.isStagedUncommitted(sha!)) {
                    gitUri.sha = sha = undefined;
                    isStagedUncommitted = true;
                }

                const log = await this.git.getLogForFile(gitUri.repoPath, gitUri.fsPath, sha, { maxCount: 2, range: args.range!, skipMerges: true });
                if (log === undefined) return Messages.showFileNotUnderSourceControlWarningMessage('Unable to open compare');

                args.commit = (sha && log.commits.get(sha)) || Iterables.first(log.commits.values());

                // If the sha is missing and the file is uncommitted, then treat it as a DiffWithWorking
                if (gitUri.sha === undefined && await this.git.isFileUncommitted(gitUri)) {
                    if (isStagedUncommitted) {
                        const diffArgs: DiffWithCommandArgs = {
                            repoPath: args.commit.repoPath,
                            lhs: {
                                sha: args.commit.sha,
                                uri: args.commit.uri
                            },
                            rhs: {
                                sha: GitService.stagedUncommittedSha,
                                uri: args.commit.uri
                            },
                            line: args.line,
                            showOptions: args.showOptions
                        };
                        return commands.executeCommand(Commands.DiffWith, diffArgs);
                    }

                    // Check if the file is staged
                    const status = await this.git.getStatusForFile(gitUri.repoPath!, gitUri.fsPath);
                    if (status !== undefined && status.indexStatus === 'M') {
                        let diffArgs: DiffWithCommandArgs;
                        // if (status.workTreeStatus === 'M') {
                            diffArgs = {
                                repoPath: args.commit.repoPath,
                                lhs: {
                                    sha: GitService.stagedUncommittedSha,
                                    uri: args.commit.uri
                                },
                                rhs: {
                                    sha: '',
                                    uri: args.commit.uri
                                },
                                line: args.line,
                                showOptions: args.showOptions
                            };
                        // }
                        // else {
                        //     diffArgs = {
                        //         repoPath: args.commit.repoPath,
                        //         lhs: {
                        //             sha: args.commit.sha, // args.commit.previousSha !== undefined ? args.commit.previousSha : GitService.deletedSha,
                        //             uri: args.commit.uri // args.commit.previousUri
                        //         },
                        //         rhs: {
                        //             sha: GitService.stagedSha,
                        //             uri: args.commit.uri
                        //         },
                        //         line: args.line,
                        //         showOptions: args.showOptions
                        //     };
                        // }

                        return commands.executeCommand(Commands.DiffWith, diffArgs);
                    }
                    return commands.executeCommand(Commands.DiffWithWorking, uri, { commit: args.commit, showOptions: args.showOptions } as DiffWithWorkingCommandArgs);
                }
            }
            catch (ex) {
                Logger.error(ex, 'DiffWithPreviousCommand', `getLogForFile(${gitUri.repoPath}, ${gitUri.fsPath})`);
                return window.showErrorMessage(`Unable to open compare. See output channel for more details`);
            }
        }

        const diffArgs: DiffWithCommandArgs = {
            repoPath: args.commit.repoPath,
            lhs: {
                sha: args.commit.previousSha !== undefined ? args.commit.previousSha : GitService.deletedSha,
                uri: args.commit.previousUri
            },
            rhs: {
                sha: args.commit.sha,
                uri: args.commit.uri
            },
            line: args.line,
            showOptions: args.showOptions
        };
        return commands.executeCommand(Commands.DiffWith, diffArgs);
    }
}