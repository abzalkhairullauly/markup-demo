import { History, type Command } from "./history";

/** A command that adds `delta` to a shared counter. */
function addCommand(
    state: { value: number },
    delta: number,
    bytes = 1,
): Command {
    state.value += delta;
    return {
        label: `add ${delta}`,
        bytes,
        undo: () => (state.value -= delta),
        redo: () => (state.value += delta),
    };
}

describe("History", () => {
    it("undoes and redoes in order", () => {
        const state = { value: 0 };
        const history = new History();
        history.push(addCommand(state, 1));
        history.push(addCommand(state, 10));
        expect(state.value).toBe(11);

        history.undo();
        expect(state.value).toBe(1);
        history.undo();
        expect(state.value).toBe(0);
        expect(history.canUndo).toBe(false);
        expect(history.undo()).toBe(false);

        history.redo();
        history.redo();
        expect(state.value).toBe(11);
        expect(history.canRedo).toBe(false);
    });

    it("drops the redo stack when a new command is pushed", () => {
        const state = { value: 0 };
        const history = new History();
        history.push(addCommand(state, 1));
        history.push(addCommand(state, 2));
        history.undo();
        history.push(addCommand(state, 5));
        expect(history.canRedo).toBe(false);
        expect(state.value).toBe(6);
    });

    it("keeps at most 50 steps by default", () => {
        const state = { value: 0 };
        const history = new History();
        for (let i = 0; i < 60; i++) {
            history.push(addCommand(state, 1));
        }
        expect(history.size).toBe(50);
        while (history.undo()) {
            // undo everything that is left
        }
        // The 10 oldest steps were dropped and can no longer be undone.
        expect(state.value).toBe(10);
    });

    it("drops old steps once the memory cap is exceeded", () => {
        const state = { value: 0 };
        const history = new History({ maxBytes: 100 });
        history.push(addCommand(state, 1, 60));
        history.push(addCommand(state, 1, 60));
        expect(history.size).toBe(1);
        expect(history.bytes).toBe(60);
    });

    it("always keeps the latest step even if it is over the cap", () => {
        const history = new History({ maxBytes: 10 });
        history.push(addCommand({ value: 0 }, 1, 1000));
        expect(history.canUndo).toBe(true);
    });

    it("tracks memory of undone steps until they are discarded", () => {
        const state = { value: 0 };
        const history = new History();
        history.push(addCommand(state, 1, 30));
        history.push(addCommand(state, 1, 20));
        history.undo();
        expect(history.bytes).toBe(50);
        history.push(addCommand(state, 1, 5));
        expect(history.bytes).toBe(35);
    });

    it("notifies listeners", () => {
        const history = new History();
        const listener = vi.fn();
        history.onChange(listener);
        history.push(addCommand({ value: 0 }, 1));
        history.undo();
        history.redo();
        history.clear();
        expect(listener).toHaveBeenCalledTimes(4);
    });
});
