import { EventEmitter } from 'events'
import fastq, { queueAsPromised } from 'fastq'
import { randomUUID } from 'crypto'
import { createQuietLogger, LogLevel } from './logger.js'

const DEFAULT_CHUNK_SIZE = 10
export const DEFAULT_NUM_TRIES = 2

export type LogMessage = {
  message: string[]
  level: LogLevel
}

type ProcessTask = {
  data: LogMessage
  tries: number
  taskId: string
}

export class LogQueue extends EventEmitter {
  private static _instance: LogQueue
  private LOGGER = createQuietLogger("log:queue", false, "test.log")()

  private taskQueue: queueAsPromised<ProcessTask>
  
  constructor(private chunkSize: number) {
    super()

    this.taskQueue = fastq.promise(this, this.writeLogMessage, this.chunkSize)
  }

  public static init(chunkSize: number = DEFAULT_CHUNK_SIZE): LogQueue {
    if (LogQueue._instance != null) {
      throw new Error("Can only init one instance of LogQueue")
    }

    LogQueue._instance = new LogQueue(chunkSize)
    return LogQueue._instance
  }

  public async addToTaskQueue(task: ProcessTask): Promise<void>
  public async addToTaskQueue(item: LogMessage): Promise<void>
  public async addToTaskQueue(itemOrTask: LogMessage | ProcessTask): Promise<void> {
    if (!itemOrTask) {
      this.LOGGER.error('Item/task is null or undefined, skipping!')
      return
    }

    let task: ProcessTask
    if ((itemOrTask as ProcessTask).taskId != null) {
      task = itemOrTask as ProcessTask
    } else {
      task = { data: itemOrTask as LogMessage, tries: 0, taskId: randomUUID() }
    }

    try {
      const success = await this.pushToQueueAndRun(task)
      if (!success) {
        await this.pushToQueueAndRun({ ...task, tries: task.tries + 1 })
      }
    } catch (e) {
      this.LOGGER.error(`Error occurred while adding new task ${task.taskId} with data ${task.data} to the queue`, e)
    }
  }

  public async writeLogMessage({ taskId, data }: ProcessTask): Promise<boolean> {
    let success: boolean = false
    try {
      //@ts-ignore
      this.LOGGER.printLog(data.level, ...data.message)
      success = true
    } catch (e) {
      this.LOGGER.error(`Processing task ${taskId} with data ${data} failed`, e)
    }
    return success
  }

  private async pushToQueueAndRun(task: ProcessTask): Promise<boolean> {
    const success = await this.taskQueue.push(task)
    return success
  }

  static get instance(): LogQueue {
    if (LogQueue._instance == null) {
      throw new Error("Must run init to initialize the LogQueue before accessing it")
    }

    return LogQueue._instance
  }
}
