'use strict';
import { ConfigurationChangeEvent, Event, EventEmitter, ExtensionContext, Uri, workspace } from 'vscode';
import { FileAnnotationType } from './annotations/annotationController';
import { ExtensionKey } from './constants';
import { LineAnnotationType } from './currentLineController';
import { GitExplorerView } from './views/gitExplorer';
import { OutputLevel } from './logger';
import { Functions } from './system';

export { ExtensionKey };

export enum CodeLensCommand {
    DiffWithPrevious = 'gitlens.diffWithPrevious',
    ShowQuickCommitDetails = 'gitlens.showQuickCommitDetails',
    ShowQuickCommitFileDetails = 'gitlens.showQuickCommitFileDetails',
    ShowQuickCurrentBranchHistory = 'gitlens.showQuickRepoHistory',
    ShowQuickFileHistory = 'gitlens.showQuickFileHistory',
    ToggleFileBlame = 'gitlens.toggleFileBlame'
}

export enum CodeLensLocations {
    Document = 'document',
    Containers = 'containers',
    Blocks = 'blocks'
}

export enum LineHighlightLocations {
    Gutter = 'gutter',
    Line = 'line',
    OverviewRuler = 'overviewRuler'
}

export enum CustomRemoteType {
    Bitbucket = 'Bitbucket',
    BitbucketServer = 'BitbucketServer',
    Custom = 'Custom',
    GitHub = 'GitHub',
    GitLab = 'GitLab'
}

export enum GitExplorerFilesLayout {
    Auto = 'auto',
    List = 'list',
    Tree = 'tree'
}

export enum StatusBarCommand {
    DiffWithPrevious = 'gitlens.diffWithPrevious',
    DiffWithWorking = 'gitlens.diffWithWorking',
    ShowQuickCommitDetails = 'gitlens.showQuickCommitDetails',
    ShowQuickCommitFileDetails = 'gitlens.showQuickCommitFileDetails',
    ShowQuickCurrentBranchHistory = 'gitlens.showQuickRepoHistory',
    ShowQuickFileHistory = 'gitlens.showQuickFileHistory',
    ToggleCodeLens = 'gitlens.toggleCodeLens',
    ToggleFileBlame = 'gitlens.toggleFileBlame'
}

export interface IAdvancedConfig {
    caching: {
        enabled: boolean;
        maxLines: number;
    };
    git: string;
    maxQuickHistory: number;
    menus: {
        explorerContext: {
            fileDiff: boolean;
            history: boolean;
            remote: boolean;
        };
        editorContext: {
            blame: boolean;
            copy: boolean;
            details: boolean;
            fileDiff: boolean;
            history: boolean;
            lineDiff: boolean;
            remote: boolean;
        };
        editorTitle: {
            blame: boolean;
            fileDiff: boolean;
            history: boolean;
            status: boolean;
        };
        editorTitleContext: {
            blame: boolean;
            fileDiff: boolean;
            history: boolean;
            remote: boolean;
        };
    };
    quickPick: {
        closeOnFocusOut: boolean;
    };
    telemetry: {
        enabled: boolean;
    };
}

export interface ICodeLensConfig {
    enabled: boolean;
    recentChange: {
        enabled: boolean;
        command: CodeLensCommand;
    };
    authors: {
        enabled: boolean;
        command: CodeLensCommand;
    };
    locations: CodeLensLocations[];
    customLocationSymbols: string[];
    perLanguageLocations: ICodeLensLanguageLocation[];
    debug: boolean;
}

export interface ICodeLensLanguageLocation {
    language: string | undefined;
    locations: CodeLensLocations[];
    customSymbols?: string[];
}

export interface IGitExplorerConfig {
    enabled: boolean;
    autoRefresh: boolean;
    view: GitExplorerView;
    files: {
        layout: GitExplorerFilesLayout;
        compact: boolean;
        threshold: number;
    };
    includeWorkingTree: boolean;
    showTrackingBranch: boolean;
    commitFormat: string;
    commitFileFormat: string;
    stashFormat: string;
    stashFileFormat: string;
    statusFileFormat: string;
    // dateFormat: string | null;
}

export interface IRemotesConfig {
    type: CustomRemoteType;
    domain: string;
    name?: string;
    protocol?: string;
    urls?: IRemotesUrlsConfig;
}

export interface IRemotesUrlsConfig {
    repository: string;
    branches: string;
    branch: string;
    commit: string;
    file: string;
    fileInBranch: string;
    fileInCommit: string;
    fileLine: string;
    fileRange: string;
}

export interface IThemeConfig {
    annotations: {
        file: {
            gutter: {
                separateLines: boolean;
                dark: {
                    backgroundColor: string | null;
                    foregroundColor: string;
                    uncommittedForegroundColor: string | null;
                };
                light: {
                    backgroundColor: string | null;
                    foregroundColor: string;
                    uncommittedForegroundColor: string | null;
                };
            };
        };

        line: {
            trailing: {
                dark: {
                    backgroundColor: string | null;
                    foregroundColor: string;
                };
                light: {
                    backgroundColor: string | null;
                    foregroundColor: string;
                };
            };
        };
    };

    lineHighlight: {
        dark: {
            backgroundColor: string;
            overviewRulerColor: string;
        };
        light: {
            backgroundColor: string;
            overviewRulerColor: string;
        };
    };
}

export const themeDefaults: IThemeConfig = {
    annotations: {
        file: {
            gutter: {
                separateLines: true,
                dark: {
                    backgroundColor: null,
                    foregroundColor: 'rgb(190, 190, 190)',
                    uncommittedForegroundColor: null
                },
                light: {
                    backgroundColor: null,
                    foregroundColor: 'rgb(116, 116, 116)',
                    uncommittedForegroundColor: null
                }
            }
        },
        line: {
            trailing: {
                dark: {
                    backgroundColor: null,
                    foregroundColor: 'rgba(153, 153, 153, 0.35)'
                },
                light: {
                    backgroundColor: null,
                    foregroundColor: 'rgba(153, 153, 153, 0.35)'
                }
            }
        }
    },
    lineHighlight: {
        dark: {
            backgroundColor: 'rgba(0, 188, 242, 0.2)',
            overviewRulerColor: 'rgba(0, 188, 242, 0.6)'
        },
        light: {
            backgroundColor: 'rgba(0, 188, 242, 0.2)',
            overviewRulerColor: 'rgba(0, 188, 242, 0.6)'
        }
    }
};

export interface IConfig {
    annotations: {
        file: {
            gutter: {
                format: string;
                dateFormat: string | null;
                compact: boolean;
                heatmap: {
                    enabled: boolean;
                    location: 'left' | 'right';
                };
                hover: {
                    details: boolean;
                    changes: boolean;
                    wholeLine: boolean;
                };
            };

            hover: {
                details: boolean;
                changes: boolean;
                heatmap: {
                    enabled: boolean;
                };
            };

            recentChanges: {
                hover: {
                    details: boolean;
                    changes: boolean;
                };
            };
        };

        line: {
            hover: {
                details: boolean;
                changes: boolean;
            };

            trailing: {
                format: string;
                dateFormat: string | null;
                hover: {
                    details: boolean;
                    changes: boolean;
                    wholeLine: boolean;
                };
            };
        };
    };

    blame: {
        ignoreWhitespace: boolean;

        file: {
            annotationType: FileAnnotationType;
            lineHighlight: {
                enabled: boolean;
                locations: LineHighlightLocations[];
            };
        };

        line: {
            enabled: boolean;
            annotationType: LineAnnotationType;
        };
    };

    recentChanges: {
        file: {
            lineHighlight: {
                locations: LineHighlightLocations[];
            };
        }
    };

    codeLens: ICodeLensConfig;

    defaultDateFormat: string | null;

    gitExplorer: IGitExplorerConfig;

    remotes: IRemotesConfig[];

    statusBar: {
        enabled: boolean;
        alignment: 'left' | 'right';
        command: StatusBarCommand;
        format: string;
        dateFormat: string | null;
    };

    strings: {
        codeLens: {
            unsavedChanges: {
                recentChangeAndAuthors: string;
                recentChangeOnly: string;
                authorsOnly: string;
            };
        };
    };

    theme: IThemeConfig;

    debug: boolean;
    insiders: boolean;
    outputLevel: OutputLevel;

    advanced: IAdvancedConfig;
}

const emptyConfig: IConfig = {
    annotations: {
        file: {
            gutter: {
                format: '',
    dateFormat: null,
    compact: false,
    heatmap: {
                    enabled: false,
        location: 'left'
    },
    hover: {
                    details: false,
        changes: false,
        wholeLine: false
    }
            },
    hover: {
                details: false,
        changes: false,
        heatmap: {
                    enabled: false
        }
            },
    recentChanges: {
                hover: {
                    details: false,
        changes: false
    }
            }
        },
    line: {
            hover: {
                details: false,
        changes: false
    },
        trailing: {
                format: '',
            dateFormat: null,
            hover: {
                    details: false,
                changes: false,
                wholeLine: false
            }
            }
        }
    },
    blame: {
        ignoreWhitespace: false,
        file: {
            annotationType: 'gutter' as FileAnnotationType,
            lineHighlight: {
                enabled: false,
                locations: []
            }
        },
        line: {
            enabled: false,
            annotationType: 'trailing' as LineAnnotationType
        }
    },
    recentChanges: {
        file: {
            lineHighlight: {
                locations: []
            }
        }
    },
    codeLens: {
        enabled: false,
        recentChange: {
            enabled: false,
            command: CodeLensCommand.DiffWithPrevious
        },
        authors: {
            enabled: false,
            command: CodeLensCommand.DiffWithPrevious
        },
        locations: [],
        customLocationSymbols: [],
        perLanguageLocations: [],
        debug: false
    },
    defaultDateFormat: null,
    gitExplorer: {
        enabled: false,
        autoRefresh: false,
        view: GitExplorerView.Auto,
        files: {
            layout: GitExplorerFilesLayout.Auto,
            compact: false,
            threshold: 0
        },
        includeWorkingTree: false,
        showTrackingBranch: false,
        commitFormat: '',
        commitFileFormat: '',
        stashFormat: '',
        stashFileFormat: '',
        statusFileFormat: ''
        // dateFormat: string | null;
    },
    remotes: [],
    statusBar: {
        enabled: false,
        alignment: 'left',
        command: StatusBarCommand.DiffWithPrevious,
        format: '',
        dateFormat: null
    },
    strings: {
        codeLens: {
            unsavedChanges: {
                recentChangeAndAuthors: '',
        recentChangeOnly: '',
        authorsOnly: ''
    }
        }
    },
    theme: themeDefaults,
    debug: false,
    insiders: false,
    outputLevel: 'verbose' as OutputLevel,
    advanced: {
        caching: {
            enabled: false,
        maxLines: 0
    },
        git: '',
        maxQuickHistory: 0,
        menus: {
            explorerContext: {
                fileDiff: false,
            history: false,
            remote: false
        },
            editorContext: {
                blame: false,
                copy: false,
                details: false,
                fileDiff: false,
                history: false,
                lineDiff: false,
                remote: false
            },
            editorTitle: {
                blame: false,
                fileDiff: false,
                history: false,
                status: false
            },
            editorTitleContext: {
                blame: false,
                fileDiff: false,
                history: false,
                remote: false
            }
        },
        quickPick: {
            closeOnFocusOut: false
        },
        telemetry: {
            enabled: false
        }
    }
};

export class Configuration {

    static configure(context: ExtensionContext) {
        context.subscriptions.push(workspace.onDidChangeConfiguration(configuration.onConfigurationChanged, configuration));
    }

    private _onDidChange = new EventEmitter<ConfigurationChangeEvent>();
    get onDidChange(): Event<ConfigurationChangeEvent> {
        return this._onDidChange.event;
    }

    private onConfigurationChanged(e: ConfigurationChangeEvent) {
        if (!e.affectsConfiguration(ExtensionKey, null!)) return;

        this._onDidChange.fire(e);
    }

    readonly defaults = { theme: themeDefaults };
    readonly initializingChangeEvent: ConfigurationChangeEvent = {
        affectsConfiguration: (section: string, resource?: Uri) => false
    };

    get<T>(section?: string, resource?: Uri | null) {
        return workspace.getConfiguration(section === undefined ? undefined : ExtensionKey, resource!).get<T>(section === undefined ? ExtensionKey : section)!;
    }

    changed(e: ConfigurationChangeEvent, section: string, resource?: Uri | null) {
        return e.affectsConfiguration(`${ExtensionKey}.${section}`, resource!);
    }

    initializing(e: ConfigurationChangeEvent) {
        return e === this.initializingChangeEvent;
    }

    name<K extends keyof IConfig>(name: K) {
        return Functions.propOf(emptyConfig, name);
    }
}

export const configuration = new Configuration();