import { Command, CommandDescriptor, CommandFlags, registerCommand } from ".";
import { MacroRegister, Register } from "../registers";

registerCommand(
  Command.macrosRecordStart,
  CommandFlags.IgnoreInHistory,
  (editorState, { currentRegister, extension }) => {
    const reg
      = ((currentRegister as any) as MacroRegister & Register) ?? extension.registers.arobase;

    if (typeof reg.setMacro === "function") {
      return editorState.startMacroRecording(reg)?.then(() => void 0);
    }

    return;
  },
);

registerCommand(
  Command.macrosRecordStop,
  CommandFlags.SwitchToNormal | CommandFlags.IgnoreInHistory,
  (editorState) => {
    return editorState.stopMacroRecording()?.then((recording) => {
      const commands = editorState.recordedCommands.slice(recording.lastHistoryEntry);

      recording.register.setMacro(
        commands.filter((x) => !(x.descriptor.flags & CommandFlags.IgnoreInHistory)),
      );
    });
  },
);

registerCommand(
  Command.macrosPlay,
  CommandFlags.ChangeSelections | CommandFlags.Edit,
  (editorState, { currentRegister, extension, repetitions }) => {
    const reg = ((currentRegister as any) as MacroRegister) ?? extension.registers.arobase;

    if (typeof reg.getMacro === "function") {
      const commands = reg.getMacro();

      if (commands !== undefined) {
        for (let i = repetitions; i > 0; i--) {
          CommandDescriptor.executeMany(editorState, commands);
        }
      }
    }
  },
);
