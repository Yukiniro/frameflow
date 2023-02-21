/**
 * Unified WebCodecs (Web*) and FFmpeg (FF*) encoder/decoder/packet/frame.
 * All packet/frame assume time_base={num: 1, den: 1_000_000}
 * TODO...
 */
import { getFFmpeg, vec2Array } from './transcoder.worker'
import * as FF from './types/ffmpeg'


type WebPacket = EncodedVideoChunk | EncodedAudioChunk
type WebFrame = VideoFrame | AudioData
type WebEncoder = VideoEncoder | AudioEncoder
type WebDecoder = VideoDecoder | AudioDecoder


// const ts_rescale = (time: number, from: AVRational, to: AVRational) => {
//     return time * from.num / from.den * to.den / to.num
// }


const dataFormatMap: 
    { pixel: {ff: string, web: VideoPixelFormat}[], 
      sample: {ff: string, web: AudioSampleFormat}[] } = 
{
    pixel: [
        {ff: 'yuv420p', web: 'I420'},
        {ff: 'yuva420p', web: 'I420A'},
        {ff: 'yuv422p', web: 'I422'},
        {ff: 'yuv444p', web: 'I444'},
        {ff: 'nv12', web: 'NV12'},
        {ff: 'rgba', web: 'RGBA'}, // choose when ff2web
        {ff: 'rgba', web: 'RGBX'},
        {ff: 'bgra', web: 'BGRA'}, // choose when ff2web
        {ff: 'bgra', web: 'BGRX'},
    ],
    sample: [
        {ff: 'u8', web: 'u8'},
        {ff: 'u8p', web: 'u8-planar'},
        {ff: 's16', web: 's16'},
        {ff: 's16p', web: 's16-planar'},
        {ff: 's32', web: 's32'},
        {ff: 's32p', web: 's32-planar'},
        {ff: 'flt', web: 'f32'},
        {ff: 'fltp', web: 'f32-planar'},
    ],
}

function formatFF2Web<T extends 'pixel' | 'sample'>(type: T, format: string): typeof dataFormatMap[T][0]['web'] {
    for (const {ff, web} of dataFormatMap[type])
        if (ff == format) return web
    throw `Cannot find ${type} format: FF ${format}`
}

function formatWeb2FF<T extends 'pixel' | 'sample'>(type: T, format: typeof dataFormatMap[T][0]['web']): string {
    for (const {ff, web} of dataFormatMap[type])
        if (web == format) return ff
    throw `Cannot find ${type} format: Web ${format}`
}


// check https://cconcolato.github.io/media-mime-support/
const codecMap: {[k in string]?: string} = {
    // video codec https://www.w3.org/TR/webcodecs-codec-registry/#video-codec-registry
    av1: 'av01.0.00M.08',
    vp8: 'vp8',
    h264: 'avc1.420034',
    vp9: 'vp09.00.10.08',
    hevc: '',
    // audio codec https://www.w3.org/TR/webcodecs-codec-registry/#audio-codec-registry
    flac: 'flac',
    mp3: 'mp3',
    mp4a: 'mp4a.40.2',
    opus: 'opus',
    vorbis: 'vorbis',
    // pcm: 'pcm-u8' // todo... not work
}

export class Packet {
    FFPacket?: FF.Packet
    WebPacket?: WebPacket
    dts = 0
    mediaType: 'video' | 'audio'
    constructor(pkt: FF.Packet | WebPacket, dts: number, mediaType: 'video' | 'audio') {
        this.dts = dts
        this.mediaType = mediaType
        if (pkt instanceof FF.Packet)
            this.FFPacket = pkt
        else
            this.WebPacket = pkt
    }

    get size() {
        return this.FFPacket?.size ?? this.WebPacket?.byteLength ?? 0
    }

    get duration() {
        return this.FFPacket?.getTimeInfo().duration ?? this.WebPacket?.duration ?? 0
    }

    toFF() {
        if (!this.FFPacket && this.WebPacket) {
            const timeInfo = {
                pts: this.WebPacket.timestamp,
                dts: this.dts,
                duration: this.WebPacket.duration ?? 0
            }
            this.FFPacket = new (getFFmpeg()).Packet(this.WebPacket.byteLength, timeInfo)
            this.WebPacket.copyTo(this.FFPacket.getData())
        }
        if (!this.FFPacket) throw `Packet.toFF failed`

        return this.FFPacket
    }

    toWeb() {
        if (!this.WebPacket && this.FFPacket) {
            const timeInfo = this.FFPacket.getTimeInfo()
            const init = {
                type: this.FFPacket.key ? 'key' : 'delta' as EncodedVideoChunkType, 
                data: this.FFPacket.getData(), 
                timestamp: timeInfo.pts, 
                duration: timeInfo.duration
            }
            this.WebPacket = this.mediaType == 'video' ? 
                new EncodedVideoChunk(init) : new EncodedAudioChunk(init)
        }
        if (!this.WebPacket) throw `Packet.toWeb failed`

        return this.WebPacket
    }

    close() {
        this.FFPacket?.delete()
        // WebPacket no need to close
    }
}

export class Frame {
    FFFrame?: FF.Frame
    WebFrame?: WebFrame
    #name: string
    constructor(frame: FF.Frame | WebFrame, name: string) {
        this.#name = name
        if (frame instanceof FF.Frame) {
            this.FFFrame = frame
        }
        else
            this.WebFrame = frame
    }

    get name() { return this.#name }

    toFF() {
        if (!this.FFFrame && this.WebFrame && this.WebFrame.format) {
            // default values
            const frameInfo: FF.FrameInfo = {
                format: '', height: 0, width: 0, channelLayout: '', channels: 0, sampleRate: 0, nbSamples: 0}

            if (this.WebFrame instanceof VideoFrame) {
                frameInfo.format = formatWeb2FF('pixel', this.WebFrame.format)
                frameInfo.height =this.WebFrame.codedHeight
                frameInfo.width = this.WebFrame.codedWidth
            }
            else {
                frameInfo.format = formatWeb2FF('sample', this.WebFrame.format)
                frameInfo.channels =this.WebFrame.numberOfChannels
                frameInfo.sampleRate = this.WebFrame.sampleRate
                frameInfo.nbSamples = this.WebFrame.numberOfFrames // todo...
            }
            this.FFFrame = new (getFFmpeg()).Frame(frameInfo, this.WebFrame.timestamp ?? 0, this.#name)
            const planes = vec2Array(this.FFFrame.getPlanes())
            planes.forEach((p, i) => this.WebFrame?.copyTo(p, {planeIndex: i}))
        }
        if (!this.FFFrame) throw `Frame.toFF() failed`

        return this.FFFrame
    }

    toWeb() {
        if (!this.WebFrame && this.FFFrame) {
            // get planes data from AVFrame
            const planes = vec2Array(this.FFFrame.getPlanes())
            const data = new Uint8Array(planes.reduce((l, d) => l + d.byteLength, 0))
            const frameInfo = this.FFFrame.getFrameInfo()
            const isVideo = frameInfo.height > 0 && frameInfo.width > 0
            
            if (isVideo) {
                const init: VideoFrameBufferInit = {
                    timestamp: this.FFFrame.pts,
                    codedHeight: frameInfo.height,
                    codedWidth: frameInfo.width,
                    format: formatFF2Web('pixel', frameInfo.format)
                }
                planes.reduce((offset, d) => {
                    data.set(d, offset)
                    return offset + d.byteLength
                }, 0)
                this.WebFrame = new VideoFrame(data, init)
            }
            else {
                const init: AudioDataInit = {
                    data,
                    timestamp: this.FFFrame.pts,
                    numberOfChannels: frameInfo.channels,
                    numberOfFrames: frameInfo.nbSamples, // todo...
                    format: formatFF2Web('sample', frameInfo.format),
                    sampleRate: frameInfo.sampleRate,
                }
                this.WebFrame = new AudioData(init)
            }
        }
        if (!this.WebFrame) throw `Frame.toWeb failed`

        return this.WebFrame
    }

    close() {
        this.FFFrame?.delete()
        this.WebFrame?.close()
    }
}


const videoEncorderConfig = (streamInfo: FF.StreamInfo): VideoEncoderConfig => {
    const config = {
        codec: codecMap[streamInfo.codecName] ?? '',
        height: streamInfo.height,
        width: streamInfo.width,
    }
    
    if (config.codec.includes('avc'))
        Object.assign(config, { avc: { format: 'annexb' } })
    
    return config
}

const audioEncoderConfig = (streamInfo: FF.StreamInfo): AudioEncoderConfig => ({
    codec: codecMap[streamInfo.codecName] ?? '',
    numberOfChannels: streamInfo.channels,
    sampleRate: streamInfo.sampleRate,
})

export class Encoder {
    encoder: FF.Encoder | WebEncoder
    streamInfo: FF.StreamInfo
    outputs: WebPacket[] = []
    dts = 0

    /**
     * @param useWebCodecs check `Encoder.isWebCodecsSupported` before contructor if `true`
     */
    constructor(streamInfo: FF.StreamInfo, useWebCodecs: boolean) {
        this.streamInfo = streamInfo

        if (useWebCodecs) {
            if (streamInfo.mediaType == 'video') {
                this.encoder = new VideoEncoder({
                    output: (chunk) => this.outputs.push(chunk), 
                    error: e => console.error(e.message)
                })
                this.encoder.configure(videoEncorderConfig(streamInfo))
            }
            else {
                this.encoder = new AudioEncoder({
                    output: (chunk) => this.outputs.push(chunk),
                    error: e => console.error(e.message)
                })
                this.encoder.configure(audioEncoderConfig(streamInfo))
            }
        }
        else {
            this.encoder = new (getFFmpeg()).Encoder(streamInfo)
        }
    }

    static async isWebCodecsSupported(streamInfo: FF.StreamInfo) {
        if (!('VideoEncoder' in window)) return false

        // todo... config override
        if (streamInfo.mediaType == 'video') {
            const { supported, config } = await VideoEncoder.isConfigSupported(videoEncorderConfig(streamInfo))
            return supported
        }
        else if (streamInfo.mediaType == 'audio') {
            const { supported, config } = await AudioEncoder.isConfigSupported(audioEncoderConfig(streamInfo))
            return supported
        }

        return false
    }

    get FFEncoder() {
        return this.encoder instanceof FF.Encoder ? this.encoder : undefined
    }

    #getPackets(pktVec?: FF.StdVector<FF.Packet>) { 
        const pkts1 = pktVec ? vec2Array(pktVec) : []
        const pkts2 = this.outputs.splice(0, this.outputs.length)
        const mediaType = this.streamInfo.mediaType
        if (!mediaType) throw `Encoder.#getPackets mediaType is undefined`
        return [...pkts1, ...pkts2].map(p => {
            const pkt = new Packet(p, this.dts, mediaType)
            this.dts += pkt.duration
            return pkt
        })
    }

    encode(frame: Frame): Packet[] {
        const mediaType = this.streamInfo.mediaType
        if (!mediaType) throw `Encoder: streamInfo.mediaType is undefined`
        // FFmpeg
        if (this.encoder instanceof FF.Encoder) {
            return this.#getPackets(this.encoder.encode(frame.toFF()))
        }
        // WebCodecs
        const webFrame = frame.toWeb()
        if (this.encoder instanceof VideoEncoder && webFrame instanceof VideoFrame) {
            this.encoder.encode(webFrame) // dts...
        }
        else if (this.encoder instanceof AudioEncoder && webFrame instanceof AudioData) {
            this.encoder.encode(webFrame) // dts...
        }
        else
            throw `Encoder.encode frame failed`
        
        return this.#getPackets()
    }

    async flush() {
        if (this.encoder instanceof FF.Encoder) {
            return this.#getPackets(this.encoder.flush())
        }
        else {
            await this.encoder.flush()
            return this.#getPackets()
        }
    }

    close() {
        if (this.encoder instanceof FF.Encoder)
            this.encoder.delete()
        else
            this.encoder.close()
    }
}


const videoDecorderConfig = (streamInfo: FF.StreamInfo): VideoDecoderConfig => ({
    codec: codecMap[streamInfo.codecName]??'',  // todo...
    codedHeight: streamInfo.height,
    codedWidth: streamInfo.width,
})

const audioDecoderConfig = (streamInfo: FF.StreamInfo): AudioDecoderConfig => ({
    codec: codecMap[streamInfo.codecName]??'',  // todo...
    numberOfChannels: streamInfo.channels,
    sampleRate: streamInfo.sampleRate
})

export class Decoder {
    #name: string
    decoder: FF.Decoder | WebDecoder
    outputs: WebFrame[] = []
    streamInfo: FF.StreamInfo

    /**
     * @param useWebCodecs check `Decoder.isWebCodecsSupported` before contructor if `true`
     */
    constructor(demuxer: FF.Demuxer | null, name: string, streamInfo: FF.StreamInfo, useWebCodecs: boolean) {
        this.streamInfo = streamInfo
        this.#name = name

        if (useWebCodecs) {
            if (streamInfo.mediaType == 'video') {
                const decoder = new VideoDecoder({
                    output: frame => this.outputs.push(frame),
                    error: e => console.error(e.message)
                })
                decoder.configure(videoDecorderConfig(streamInfo))
                this.decoder = decoder
            }
            else {
                const decoder = new AudioDecoder({
                    output: frame => this.outputs.push(frame),
                    error: e => console.error(e.message)
                })
                decoder.configure(audioDecoderConfig(streamInfo))
                this.decoder = decoder
            }
        }
        else {
            this.decoder = demuxer ?
                new (getFFmpeg()).Decoder(demuxer, streamInfo.index, name) :
                new (getFFmpeg()).Decoder(streamInfo, name)
        }
    }

    static async isWebCodecsSupported(streamInfo: FF.StreamInfo) {
        if (!('VideoEncoder' in window)) return false

        if (streamInfo.mediaType == 'video') {
            const { supported } = await VideoDecoder.isConfigSupported(videoDecorderConfig(streamInfo))
            return supported
        }
        else if (streamInfo.mediaType == 'audio') {
            const { supported } = await AudioDecoder.isConfigSupported(audioDecoderConfig(streamInfo))
            return supported
        }

        return false
    }

    get mediaType() {
        const mediaType = this.streamInfo.mediaType
        if (!mediaType) throw `Decoder.mediaType is undefined`
        return mediaType
    }

    /* get frames from inputs or this.outputs */
    #getFrames(frameVec?: FF.StdVector<FF.Frame>) {
        const frames1 = frameVec ? vec2Array(frameVec) : []
        const frames2 = this.outputs.splice(0, this.outputs.length)
        return [...frames1, ...frames2].map(f => new Frame(f, this.#name))
    }

    decode(pkt: Packet) {
        if (this.decoder instanceof FF.Decoder) {
            return this.#getFrames(this.decoder.decode(pkt.toFF()))
        }
        else {
            this.decoder.decode(pkt.toWeb())
            return this.#getFrames()
        }
    }

    async flush() {
        if (this.decoder instanceof FF.Decoder) {
            return this.#getFrames(this.decoder.flush())
        }
        else {
            await this.decoder.flush()
            return this.#getFrames()
        }
    }

    close() {
        if (this.decoder instanceof FF.Decoder)
            this.decoder.delete()
        else
            this.decoder.close()
    }
}