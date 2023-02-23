/**
 * definition of graphs:
 *  UserGraph -> GraphInstance -> GraphRuntime
 */

import { SourceType } from "../streamIO"

export type BufferData = Uint8Array | Buffer
export type ChunkData = BufferData | VideoFrame | AudioData
export interface WriteChunkData { data: ChunkData, offset: number }


interface Rational {num: number, den: number}
/**
 * all kinds of metadata infomation
 */

export interface FormatMetadata {
    formatName: string
    duration: number
    bitRate: number
}

interface CommonStreamMetadata {
    index: number,
    timeBase: Rational
    startTime: number,
    duration: number,
    bitRate: number,
    codecName: string,
    extraData: Uint8Array
}

/**
 * Video Track (stream) metadata
 */
export interface VideoStreamMetadata extends CommonStreamMetadata {
    /**
     * mediaType = 'video' or 'audio'
     */
    mediaType: 'video'
    /**
     * height of video frame
     */
    height: number,
    width: number,
    pixelFormat: string
    frameRate: number
    sampleAspectRatio: Rational
}

export interface AudioStreamMetadata extends CommonStreamMetadata {
    mediaType: 'audio'
    volume: number
    sampleFormat: string
    sampleRate: number
    channels: number
    channelLayout: string
}

export type StreamMetadata = AudioStreamMetadata | VideoStreamMetadata


/**
 * user defined graph
 */
type UserNode = SourceNode | FilterNode | TargetNode
export type SourceType = ReadableStream<BufferData> | string | URL | RequestInfo | Blob | BufferData
interface StreamRef { from: SourceNode | FilterNode, index: number }
export interface SourceNode {
    type: 'source', outStreams: StreamMetadata[], source: SourceType, url?: string
    format: { type: 'file', container: FormatMetadata, fileSize: number } | 
            { type: 'stream', elementType: 'frame' | 'chunk' }
}

interface FilterNode {
    type: 'filter', inStreams: StreamRef[], outStreams: StreamMetadata[], 
    filter: { name: string, ffmpegArgs: string | {[k in string]?: string | number} }
}

interface TargetNode {
    type: 'target', inStreams: StreamRef[], outStreams: StreamMetadata[], 
    format: { type: 'frame' | 'video', container: FormatMetadata }
}

type StreamInstanceRef = {from: string, index: number}
type SourceInstance = Omit<SourceNode, "source"> & {id: string}
type FilterInstance = Omit<FilterNode, "inStreams"> & {inStreams: StreamInstanceRef[], id: string}
type TargetInstance = Omit<TargetNode, "inStreams"> & {inStreams: StreamInstanceRef[], id: string}

/**
 * graph instance for execution
 */
export interface GraphInstance {
    nodes: {[id in string]?: SourceInstance | FilterInstance | TargetInstance}
    sources: string[]
    filterInstance?: {
        inputs: StreamInstanceRef[],
        outputs: StreamInstanceRef[]
        filters: string[],
    }
    targets: string[]
}