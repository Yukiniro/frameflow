#ifndef PACKET_H
#define PACKET_H

#include <emscripten/val.h>
extern "C" {
    #include <libavcodec/avcodec.h>
}


class Packet {
    AVPacket* packet;
public:
    Packet() { packet = av_packet_alloc(); }
    Packet(int bufSize, int64_t pts) {
        packet = av_packet_alloc();
        av_new_packet(packet, bufSize);
        packet->pts = pts;
    }
    ~Packet() { av_packet_free(&packet); };
    bool isEmpty() { packet->data == NULL; }
    int stream_index() { return packet->stream_index; }
    val getData() { 
        return val(typed_memory_view(packet->size, packet->data)); // check length of data
    }
    AVPacket* av_packet() { return packet; }
};

#endif