var parent = require('../../worker/parent');
var buildView = require('./buildView');
var atomUtils = require('./atomUtils');
var autoCompleteProvider = require('./autoCompleteProvider');
var path = require('path');
var renameView = require('./views/renameView');
var apd = require('atom-package-dependencies');
var contextView = require('./views/contextView');
function commandForTypeScript(e) {
    var editor = atom.workspace.getActiveTextEditor();
    if (!editor)
        return e.abortKeyBinding() && false;
    if (path.extname(editor.getPath()) !== '.ts')
        return e.abortKeyBinding() && false;
    return true;
}
function registerCommands() {
    atom.commands.add('atom-text-editor', 'typescript:format-code', function (e) {
        if (!commandForTypeScript(e))
            return;
        var editor = atom.workspace.getActiveTextEditor();
        var filePath = editor.getPath();
        var selection = editor.getSelectedBufferRange();
        if (selection.isEmpty()) {
            parent.formatDocument({
                filePath: filePath
            }).then(function (result) {
                if (!result.edits.length)
                    return;
                editor.transact(function () {
                    atomUtils.formatCode(editor, result.edits);
                });
            });
        }
        else {
            parent.formatDocumentRange({
                filePath: filePath,
                start: {
                    line: selection.start.row,
                    col: selection.start.column
                },
                end: {
                    line: selection.end.row,
                    col: selection.end.column
                }
            }).then(function (result) {
                if (!result.edits.length)
                    return;
                editor.transact(function () {
                    atomUtils.formatCode(editor, result.edits);
                });
            });
        }
    });
    atom.commands.add('atom-workspace', 'typescript:build', function (e) {
        if (!commandForTypeScript(e))
            return;
        var editor = atom.workspace.getActiveTextEditor();
        var filePath = editor.getPath();
        atom.notifications.addInfo('Building');
        parent.build({
            filePath: filePath
        }).then(function (resp) {
            buildView.setBuildOutput(resp.buildOutput);
        });
    });
    var handleGoToDeclaration = function (e) {
        if (!commandForTypeScript(e))
            return;
        var editor = atom.workspace.getActiveTextEditor();
        var filePath = editor.getPath();
        var position = atomUtils.getEditorPosition(editor);
        parent.getDefinitionsAtPosition({
            filePath: filePath,
            position: position
        }).then(function (res) {
            var definitions = res.definitions;
            if (!definitions || !definitions.length) {
                atom.notifications.addInfo('AtomTS: No definition found.');
                return;
            }
            var definition = definitions[0];
            atom.workspace.open(definition.filePath, {
                initialLine: definition.position.line,
                initialColumn: definition.position.col
            });
        });
    };
    atom.commands.add('atom-workspace', 'typescript:go-to-declaration', handleGoToDeclaration);
    atom.commands.add('atom-text-editor', 'symbols-view:go-to-declaration', handleGoToDeclaration);
    var theContextView;
    atom.commands.add('atom-text-editor', 'typescript:context-actions', function (e) {
        if (!theContextView)
            theContextView = new contextView.ContextView();
        theContextView.show();
        atom.notifications.addSuccess('Context options coming soon!');
    });
    atom.commands.add('atom-text-editor', 'typescript:autocomplete', function (e) {
        autoCompleteProvider.triggerAutocompletePlus();
    });
    atom.commands.add('atom-text-editor', 'typescript:bas-development-testing', function (e) {
        parent.debugLanguageServiceHostVersion({
            filePath: atom.workspace.getActiveEditor().getPath()
        }).then(function (res) {
            console.log(res.text.length);
        });
    });
    atom.commands.add('atom-text-editor', 'typescript:rename-variable', function (e) {
        parent.getRenameInfo(atomUtils.getFilePathPosition()).then(function (res) {
            if (!res.canRename) {
                atom.notifications.addInfo('AtomTS: Rename not available at cursor location');
                return;
            }
            renameView.panelView.renameThis({
                text: res.displayName,
                onCancel: function () {
                },
                onCommit: function (newText) {
                    atomUtils.getEditorsForAllPaths(Object.keys(res.locations)).then(function (editorMap) {
                        Object.keys(res.locations).forEach(function (filePath) {
                            var editor = editorMap[filePath];
                            editor.transact(function () {
                                res.locations[filePath].forEach(function (textSpan) {
                                    var range = atomUtils.getRangeForTextSpan(editor, textSpan);
                                    editor.setTextInBufferRange(range, newText);
                                });
                            });
                        });
                    });
                }
            });
        });
    });
}
exports.registerCommands = registerCommands;
//# sourceMappingURL=commands.js.map