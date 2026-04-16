class DownloadQueueService {
  constructor({ logger }) {
    this.logger = logger;
    this.running = false;
    this.queue = [];
  }

  enqueue(task) {
    this.queue.push(task);
    this.drain().catch((error) => {
      this.logger.error("Error in import queue", {
        error: error.message,
      });
    });
  }

  async drain() {
    if (this.running) {
      return;
    }

    this.running = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      await task();
    }

    this.running = false;
  }
}

module.exports = DownloadQueueService;
