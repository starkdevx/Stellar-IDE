export interface QueueItem {
  id: string;
  projectName: string;
  enqueuedAt: number;
  task: () => Promise<void>;
}

class CompileQueueManager {
  private queue: QueueItem[] = [];
  private isProcessing: boolean = false;
  private maxQueueSize: number = 100;

  /**
   * Enqueues a compilation task to be processed sequentially (FIFO)
   */
  public enqueue(projectName: string, task: () => Promise<void>): { success: boolean; id: string; error?: string } {
    if (this.queue.length >= this.maxQueueSize) {
      const warnMsg = `[QUEUE REJECTED] Max queue limit (${this.maxQueueSize}) reached. Rejecting compile task for "${projectName}".`;
      console.warn(warnMsg);
      return { 
        success: false, 
        id: "", 
        error: "Server is currently experiencing high compilation traffic. Please try again in a few seconds." 
      };
    }

    const id = `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const queueItem: QueueItem = {
      id,
      projectName,
      enqueuedAt: Date.now(),
      task,
    };

    this.queue.push(queueItem);
    console.log(`[QUEUE ENQUEUED] Task ID: ${id} | Project: "${projectName}" | Queue position: ${this.queue.length}`);

    this.processNext();
    return { success: true, id };
  }

  private async processNext() {
    if (this.isProcessing) return;

    const item = this.queue.shift();
    if (!item) return;

    this.isProcessing = true;
    const startTime = Date.now();
    const waitTime = ((startTime - item.enqueuedAt) / 1000).toFixed(2);
    console.log(`[QUEUE START] Task ID: ${item.id} | Project: "${item.projectName}" | Wait time in queue: ${waitTime}s | Remaining in queue: ${this.queue.length}`);

    try {
      await item.task();
    } catch (err: any) {
      console.error(`[QUEUE ERROR] Task ID: ${item.id} | Project: "${item.projectName}" failed:`, err.message || err);
    } finally {
      const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[QUEUE FINISHED] Task ID: ${item.id} | Project: "${item.projectName}" | Build duration: ${executionTime}s`);
      this.isProcessing = false;
      this.processNext();
    }
  }

  public getStats() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
    };
  }
}

export const compileQueue = new CompileQueueManager();
