// Unfortunately, some keys cannot be registered with AZERTY keyboard,
// notably because these keys are triggered using Alt Gr (eg. the pipe '|').
//
// Therefore, some commands were moved around to make them available
// in a 'natural' way.

export const overrides = [
  {
    "key": "ctrl+g",
    "command": "workbench.action.gotoLine",
  },
  {
    "key": "ctrl+g",
    "command": "-workbench.action.gotoLine",
  },
  {
    "key": "1",
    "command": "dance.selections.align",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "shift+0",
    "command": "dance.count.0",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "0",
    "command": "-dance.count.0",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "shift+1",
    "command": "dance.count.1",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "1",
    "command": "-dance.count.1",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "shift+2",
    "command": "dance.count.2",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "2",
    "command": "-dance.count.2",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "shift+3",
    "command": "dance.count.3",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "3",
    "command": "-dance.count.3",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "shift+4",
    "command": "dance.count.4",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "4",
    "command": "-dance.count.4",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "shift+5",
    "command": "dance.count.5",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "5",
    "command": "-dance.count.5",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "shift+6",
    "command": "dance.count.6",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "6",
    "command": "-dance.count.6",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "shift+7",
    "command": "dance.count.7",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "7",
    "command": "-dance.count.7",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "shift+8",
    "command": "dance.count.8",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "8",
    "command": "-dance.count.8",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "shift+9",
    "command": "dance.count.9",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "9",
    "command": "-dance.count.9",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "oem_102",
    "command": "dance.deindent",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "shift+oem_102",
    "command": "dance.indent",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "unknown",
    "command": "-dance.selections.align",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "unknown",
    "command": "-dance.deindent",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "unknown",
    "command": "-dance.indent",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "oem_1",
    "command": "dance.pipe.filter",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "shift+4",
    "command": "-dance.pipe.filter",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "oem_8",
    "command": "dance.pipe.append",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "shift+1",
    "command": "-dance.pipe.append",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "alt+oem_8",
    "command": "dance.pipe.prepend",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "shift+alt+1",
    "command": "-dance.pipe.prepend",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "shift+alt+oem_8",
    "command": "dance.pipe.ignore",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "shift+alt+oem_5",
    "command": "-dance.pipe.ignore",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "shift+oem_8",
    "command": "dance.pipe.replace",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "shift+oem_5",
    "command": "-dance.pipe.replace",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "alt+1",
    "command": "dance.selections.align.copy",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "alt+unknown",
    "command": "-dance.selections.align.copy",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "shift+alt+oem_102",
    "command": "dance.indent.withEmpty",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "alt+unknown",
    "command": "-dance.indent.withEmpty",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "alt+oem_102",
    "command": "dance.deindent.further",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "alt+unknown",
    "command": "-dance.deindent.further",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "shift+alt+oem_5",
    "command": "dance.objects.selectToEnd.extend.inner",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "shift+alt+unknown",
    "command": "-dance.objects.selectToEnd.extend.inner",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "shift+alt+oem_3",
    "command": "dance.objects.selectToStart.extend.inner",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "shift+alt+unknown",
    "command": "-dance.objects.selectToStart.extend.inner",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "shift+oem_5",
    "command": "dance.objects.selectToEnd.extend",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "shift+unknown",
    "command": "-dance.objects.selectToEnd.extend",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "shift+oem_3",
    "command": "dance.objects.selectToStart.extend",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "shift+unknown",
    "command": "-dance.objects.selectToStart.extend",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "alt+oem_period",
    "command": "dance.selections.flip",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "alt+oem_1",
    "command": "-dance.selections.flip",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "shift+alt+oem_period",
    "command": "dance.selections.forward",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "shift+alt+oem_1",
    "command": "-dance.selections.forward",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "alt+8",
    "command": "dance.selections.merge",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "alt+unknown",
    "command": "-dance.selections.merge",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "oem_period",
    "command": "dance.selections.reduce",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "oem_1",
    "command": "-dance.selections.reduce",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "shift+oem_period",
    "command": "dance.repeat.insert",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "oem_period",
    "command": "-dance.repeat.insert",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "oem_4",
    "command": "dance.rotate",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "unknown",
    "command": "-dance.rotate",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "5",
    "command": "dance.rotate.backwards",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "unknown",
    "command": "-dance.rotate.backwards",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "alt+oem_4",
    "command": "dance.rotate.content",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "alt+unknown",
    "command": "-dance.rotate.content",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "alt+5",
    "command": "dance.rotate.content.backwards",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "alt+unknown",
    "command": "-dance.rotate.content.backwards",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "oem_2",
    "command": "dance.search",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "unknown",
    "command": "-dance.search",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "shift+oem_2",
    "command": "dance.search.extend",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "shift+unknown",
    "command": "-dance.search.extend",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "alt+oem_2",
    "command": "dance.search.backwards",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "alt+unknown",
    "command": "-dance.search.backwards",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "shift+alt+oem_2",
    "command": "dance.search.backwards.extend",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "shift+alt+unknown",
    "command": "-dance.search.backwards.extend",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "3",
    "command": "dance.registers.select",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "unknown",
    "command": "-dance.registers.select",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "alt+oem_5",
    "command": "dance.objects.selectToEnd.inner",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "alt+unknown",
    "command": "-dance.objects.selectToEnd.inner",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "unknown",
    "command": "-dance.toUpperCase",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "oem_3",
    "command": "-dance.toLowerCase",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "oem_3",
    "command": "dance.objects.selectToStart",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "unknown",
    "command": "-dance.objects.selectToStart",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "oem_5",
    "command": "dance.objects.selectToEnd",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "unknown",
    "command": "-dance.objects.selectToEnd",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "alt+oem_3",
    "command": "dance.objects.selectToStart.inner",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "alt+unknown",
    "command": "-dance.objects.selectToStart.inner",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "oem_7",
    "command": "dance.toLowerCase",
  },
  {
    "key": "shift+oem_7",
    "command": "dance.toUpperCase",
  },
  {
    "key": "alt+oem_7",
    "command": "dance.swapCase",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
  {
    "key": "alt+oem_3",
    "command": "-dance.swapCase",
    "when": "editorTextFocus && dance.mode == 'normal'",
  },
];
