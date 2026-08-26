export class BoundedCapture {
  constructor(maxBytes = 64 * 1024) {
    this.maxBytes = maxBytes;
    this.totalBytes = 0;
    this.headLimit = Math.floor(maxBytes / 2);
    this.tailLimit = maxBytes - this.headLimit;
    this.head = Buffer.alloc(0);
    this.tail = Buffer.alloc(0);
  }

  append(chunk) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    this.totalBytes += buffer.length;

    if (this.head.length < this.headLimit) {
      const needed = this.headLimit - this.head.length;
      this.head = Buffer.concat([this.head, buffer.subarray(0, needed)]);
    }

    this.tail = Buffer.concat([this.tail, buffer]);
    if (this.tail.length > this.tailLimit) {
      this.tail = this.tail.subarray(this.tail.length - this.tailLimit);
    }
  }

  value() {
    if (this.totalBytes <= this.maxBytes) {
      return {
        text: this.tail.toString("utf8"),
        totalBytes: this.totalBytes,
        omittedBytes: 0,
      };
    }

    const omittedBytes = this.totalBytes - this.head.length - this.tail.length;
    return {
      text: `${this.head.toString("utf8")}\n\n<issueproof: omitted ${omittedBytes} bytes>\n\n${this.tail.toString("utf8")}`,
      totalBytes: this.totalBytes,
      omittedBytes,
    };
  }
}
