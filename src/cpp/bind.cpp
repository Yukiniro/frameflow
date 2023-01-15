#ifndef BIND_H
#define BIND_H

#include <emscripten/bind.h>
#include "metadata.h"
#include "stream.h"
#include "encode.h"
#include "demuxer.h"
#include "decode.h"
#include "filter.h"
#include "muxer.h"
#include "utils.h"
using namespace emscripten;


EMSCRIPTEN_BINDINGS(metadata) {
    value_object<StreamInfo>("StreamInfo")
        .field("index", &StreamInfo::index)
        .field("timeBase", &StreamInfo::time_base)
        .field("bitRate", &StreamInfo::bit_rate)
        .field("startTime", &StreamInfo::start_time)
        .field("duration", &StreamInfo::duration)
        .field("mediaType", &StreamInfo::codec_type)
        .field("codecName", &StreamInfo::codec_name)
        .field("format", &StreamInfo::format)
        .field("width", &StreamInfo::width)
        .field("height", &StreamInfo::height)
        .field("frameRate", &StreamInfo::frame_rate)
        .field("sampleAspectRatio", &StreamInfo::sample_aspect_ratio)
        .field("sampleRate", &StreamInfo::sample_rate)
        .field("channelLayout", &StreamInfo::channel_layout)
        .field("channels", &StreamInfo::channels)
    ;

    value_object<FormatInfo>("FormatInfo")
        .field("formatName", &FormatInfo::format_name)
        .field("bitRate", &FormatInfo::bit_rate)
        .field("duration", &FormatInfo::duration)
        .field("streamInfos", &FormatInfo::streamInfos)
    ;
}

EMSCRIPTEN_BINDINGS(demuxer) {

    class_<Demuxer>("Demuxer")
        .constructor<emscripten::val>()
        // .property("streams", &Demuxer::getStreams)
        .function("seek", &Demuxer::seek)
        .function("read", &Demuxer::read)
        .function("getMetadata", &Demuxer::getMetadata)
    ;
}

EMSCRIPTEN_BINDINGS(decode) {
    class_<Decoder>("Decoder")
        .constructor<std::string>()
        .constructor<Demuxer&, int>()
        .function("decode", &Decoder::decode)
        .function("flush", &Decoder::flush)
        ;

}

EMSCRIPTEN_BINDINGS(stream) {
    
}

EMSCRIPTEN_BINDINGS(packet) {
    class_<Packet>("Packet")
        .constructor<int, int64_t>()
        .property("isEmpty", &Packet::isEmpty)
        .property("streamIndex", &Packet::stream_index, &Packet::set_stream_index)
        .function("getData", &Packet::getData)
    ;
}

EMSCRIPTEN_BINDINGS(frame) {
    class_<Frame>("Frame")
        // .constructor<FrameParams>()
        // .function("imageData", &Frame::getImageData)
    ;
}

EMSCRIPTEN_BINDINGS(filter) {
    class_<Filterer>("Filterer")
        .constructor<std::map<std::string, std::string>, std::map<std::string, std::string>, std::map<std::string, std::string>, std::string>()
        .function("filter", &Filterer::filter)
    ;
    
}

EMSCRIPTEN_BINDINGS(encode) {
    value_object<AVRational>("AVRational")
        .field("num", &AVRational::num)
        .field("den", &AVRational::den)
    ;
    
    class_<Encoder>("Encoder")
        .constructor<StreamInfo>()
        .function("encode", &Encoder::encode)
        .function("flush", &Encoder::flush)
    ;
}

EMSCRIPTEN_BINDINGS(muxer) {
    class_<Muxer>("Muxer")
        .constructor<std::string, emscripten::val>()
        .class_function("inferFormatInfo", &Muxer::inferFormatInfo)
        .function("openIO", &Muxer::openIO)
        .function("newStream", &Muxer::newStream)
        .function("writeHeader", &Muxer::writeHeader)
        .function("writeTrailer", &Muxer::writeTrailer)
        .function("writeFrame", &Muxer::writeFrame)
    ;

    value_object<InferredFormatInfo>("InferredFormatInfo")
        .field("format", &InferredFormatInfo::format)
        .field("videoCodec", &InferredFormatInfo::videoCodec)
        .field("audioCodec", &InferredFormatInfo::audioCodec)
    ;
}

EMSCRIPTEN_BINDINGS(utils) {
    emscripten::function("createFrameMap", &createMap<std::string, Frame>);
    emscripten::function("createStringStringMap", &createMap<std::string, std::string>);

	register_vector<Frame>("vector<Frame>");
	register_vector<Packet>("vector<Packet>");
	register_vector<StreamInfo>("vector<StreamInfo>");
    register_map<std::string, std::string>("MapStringString");
}

#endif