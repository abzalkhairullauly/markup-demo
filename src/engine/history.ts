/**
 * Anything that can be undone. Commands are created *after* the change has
 * been applied, so `push()` never calls `redo()`.
 */
export interface Command {
    readonly label: string;
    /** Approximate memory held by the command, used to cap the stack. */
    readonly bytes: number;
    undo(): void;
    redo(): void;
}

export interface HistoryOptions {
    /** Maximum number of undo steps. */
    limit?: number;
    /** Soft memory cap; oldest steps are dropped once it is exceeded. */
    maxBytes?: number;
}

export class History {
    readonly limit: number;
    readonly maxBytes: number;

    private done: Command[] = [];
    private undone: Command[] = [];
    private totalBytes = 0;
    private listeners = new Set<() => void>();

    constructor(options: HistoryOptions = {}) {
        this.limit = options.limit ?? 50;
        this.maxBytes = options.maxBytes ?? 512 * 1024 * 1024;
    }

    get canUndo(): boolean {
        return this.done.length > 0;
    }

    get canRedo(): boolean {
        return this.undone.length > 0;
    }

    get size(): number {
        return this.done.length;
    }

    get bytes(): number {
        return this.totalBytes;
    }

    onChange(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    push(command: Command): void {
        for (const dropped of this.undone) {
            this.totalBytes -= dropped.bytes;
        }
        this.undone = [];
        this.done.push(command);
        this.totalBytes += command.bytes;
        this.trim();
        this.emit();
    }

    undo(): boolean {
        const command = this.done.pop();
        if (!command) {
            return false;
        }
        command.undo();
        this.undone.push(command);
        this.emit();
        return true;
    }

    redo(): boolean {
        const command = this.undone.pop();
        if (!command) {
            return false;
        }
        command.redo();
        this.done.push(command);
        this.emit();
        return true;
    }

    clear(): void {
        this.done = [];
        this.undone = [];
        this.totalBytes = 0;
        this.emit();
    }

    private trim(): void {
        // Always keep the latest step, even if it alone is over the cap.
        while (
            this.done.length > 1 &&
            (this.done.length > this.limit || this.totalBytes > this.maxBytes)
        ) {
            const oldest = this.done.shift();
            if (oldest) {
                this.totalBytes -= oldest.bytes;
            }
        }
    }

    private emit(): void {
        for (const listener of this.listeners) {
            listener();
        }
    }
}
