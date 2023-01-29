#include "metadata.h"

// from timestamp in time_base to seconds
inline double toSeconds(int64_t time_ts, AVRational& time_base) {
    return time_ts != AV_NOPTS_VALUE ? 
        time_ts * (double)time_base.num / time_base.den : 0;
}

StreamInfo createStreamInfo(AVStream* s) {
    StreamInfo info;
    info.index = s->index;
    auto par = s->codecpar;
    info.time_base = s->time_base;
    info.bit_rate = par->bit_rate;
    info.start_time = toSeconds(s->start_time, s->time_base);
    info.duration = toSeconds(s->duration, s->time_base);
    info.codec_name = avcodec_find_decoder(par->codec_id)->name;
    if (par->codec_type == AVMEDIA_TYPE_VIDEO) {
        info.codec_type = "video";
        info.width = par->width;
        info.height = par->height;
        info.frame_rate = av_q2d(s->avg_frame_rate);
        info.sample_aspect_ratio = s->sample_aspect_ratio;
        info.format = av_get_pix_fmt_name((AVPixelFormat)par->format);
    }
    else if (par->codec_type == AVMEDIA_TYPE_AUDIO) {
        info.codec_type = "audio";
        info.sample_rate = par->sample_rate;
        info.channels = par->channels;
        info.format = av_get_sample_fmt_name((AVSampleFormat)par->format);
        // get description of channel_layout
        int buf_size = 256;
        char buf[buf_size];
        av_get_channel_layout_string(buf, buf_size, par->channels, par->channel_layout);
        info.channel_layout = buf;
    }

    return info;
}

/**
 * @param num_list ended with 0
 * @return index of num_list
 */
int find_nearest_number(int num, const int* num_list) {
    int id = 0, diff = abs(num - num_list[0]);
    for (int i = 1; num_list[i] != 0; i++) {
        id = abs(num - num_list[i]) < diff ? i : id;
    }
    return id;
}

void set_avcodec_context_from_streamInfo(StreamInfo& info, AVCodecContext* ctx) {
    ctx->bit_rate = info.bit_rate;
    ctx->time_base = info.time_base;
    auto codec = ctx->codec;
    if (info.codec_type == "video") {
        ctx->codec_type = AVMEDIA_TYPE_VIDEO;
        ctx->width = info.width;
        ctx->height = info.height;
        ctx->sample_aspect_ratio = info.sample_aspect_ratio;
        ctx->pix_fmt = av_get_pix_fmt(info.format.c_str());
        // find proper frame_rate
        auto frame_rate = av_d2q(info.frame_rate, INT_MAX);
        if (codec->supported_framerates != NULL) {
            auto id = av_find_nearest_q_idx(frame_rate, codec->supported_framerates);
            ctx->framerate = codec->supported_framerates[id];
        }
        else
            ctx->framerate = frame_rate;
    }
    else if (info.codec_type == "audio") {
        ctx->codec_type = AVMEDIA_TYPE_AUDIO;
        ctx->channels = info.channels;
        ctx->sample_fmt = av_get_sample_fmt(info.format.c_str());
        ctx->channel_layout = av_get_channel_layout(info.channel_layout.c_str());
        // find proper sample_rate
        if (codec->supported_samplerates != NULL) {
            auto id = find_nearest_number(info.sample_rate, codec->supported_samplerates);
            // printf("sample_rate %d\n", codec->supported_samplerates[id]);
            ctx->sample_rate = codec->supported_samplerates[id];
        }
        else
            ctx->sample_rate = info.sample_rate;
    }
}


FormatInfo createFormatInfo(AVFormatContext* p) {
    FormatInfo info;
    info.format_name = p->iformat->name;
    info.bit_rate = p->bit_rate;
    auto time_base_q = AV_TIME_BASE_Q;
    info.duration = toSeconds(p->duration, time_base_q);
    for (int i = 0; i < p->nb_streams; i++) {
        auto codec_type = p->streams[i]->codecpar->codec_type;
        if (codec_type == AVMEDIA_TYPE_VIDEO || codec_type == AVMEDIA_TYPE_AUDIO)
            info.streamInfos.push_back(createStreamInfo(p->streams[i]));
    }
    
    return info;
}
