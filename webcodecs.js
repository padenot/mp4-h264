import {
  Muxer as MP4Muxer,
  ArrayBufferTarget,
} from "https://unpkg.com/mp4-muxer/build/mp4-muxer.mjs";
import {
  Muxer as WebMMuxer,
  ArrayBufferTarget as ArrayBufferTarget2,
} from "https://unpkg.com/webm-muxer/build/webm-muxer.mjs";
import { renderer, blobToVideo } from "./shared.js";

// Pixels
const width = 7680 / 2;
const height = 4320 / 2;
// Hz
const fps = 60;
// seconds
const duration = 3;
// bits per second
const bitrate_h264 = 2000000 * 4;
const bitrate_vp9 =  2000000 / 2;

let $ = document.querySelector.bind(document);

console.time("stream");
let mp4muxer = new MP4Muxer({
  target: new ArrayBufferTarget(),
  video: {
    codec: "avc",
    width,
    height,
  },
  fastStart: "in-memory",
});
let webmmuxer = new WebMMuxer({
  target: new ArrayBufferTarget2(),
  video: {
    codec: 'V_VP9',
    width,
    height,
  },
  fastStart: "in-memory",
});

let gTotalFrames = 0;
let gInputIndex = 0;
let gWebMOutputIdx = 0;
let gMP4OutputIdx = 0;

let videoEncoder = new VideoEncoder({
  output: (chunk, meta) => {
    gMP4OutputIdx++;
    $("#mp4").value = 100 * gMP4OutputIdx / gTotalFrames;
    mp4muxer.addVideoChunk(chunk, meta);
  },
  error: (e) => console.error(e)
});
let videoEncoderVP9 = new VideoEncoder({
  output: (chunk, meta) => {
    gWebMOutputIdx++;
    $("#webm").value = 100 * gWebMOutputIdx / gTotalFrames;
    webmmuxer.addVideoChunk(chunk, meta);
  },
  error: (e) => console.error(e),
});
videoEncoder.configure({
  codec: "avc1.64003e",
  width,
  height,
  bitrate: bitrate_h264,
  bitrateMode: "variable",
});
videoEncoderVP9.configure({
  codec: "vp09.00.40.08",
  width,
  height,
  bitrate: bitrate_vp9,
  bitrateMode: "variable",
});


function once(target, name) {
  return new Promise(r => target.addEventListener(name, r, { once: true }));
}

async function encodeOne(videoEncoder, frame, meta, frameIndex, totalFrames) {
  gInputIndex++;
  $("#input").value = 100 * gInputIndex / gTotalFrames;
  var encodeQueueSizeH264 = videoEncoder.encodeQueueSize;
  videoEncoder.encode(frame, meta);
  var encodeQueueSizeVP9 = videoEncoderVP9.encodeQueueSize;
  videoEncoderVP9.encode(frame, meta);
  frame.close();
  // To investigate, Chrome bug with the dequeue event?
  // if (encodeQueueSizeH264 != videoEncoder.encodeQueueSize) {
  //   await once(videoEncoder, "dequeue");
  // }
  // if (encodeQueueSizeVP9 != videoEncoderVP9.encodeQueueSizeVP9) {
  //   await once(videoEncoderVP9, "dequeue");
  // }
  await new Promise((r) => requestAnimationFrame(r));
}

for (let result of renderer({
  width,
  height,
  fps,
  duration,
})) {
  const { canvas, frame: frameIndex, totalFrames } = result;

  gTotalFrames = totalFrames;
  gInputIndex = frameIndex;

  const timestamp = (1 / fps) * frameIndex;
  const keyFrame = frameIndex % 30 === 0;

  let frame = new VideoFrame(canvas, {
    timestamp: timestamp * 1000000, // in microseconds
    duration: (1 / fps) * 1000000, // in microseconds
  });

  await encodeOne(videoEncoder, frame, {keyFrame: keyFrame}, frameIndex, totalFrames)
}

await videoEncoder.flush();
mp4muxer.finalize();
await videoEncoderVP9.flush();
webmmuxer.finalize();

var { buffer } = mp4muxer.target; // Buffer contains final MP4 file
var blob = new Blob([buffer], { type: "video/mp4" });
console.timeEnd("stream");
document.body.appendChild(blobToVideo(blob, width, height, "MP4"));
var { buffer } = webmmuxer.target; // Buffer contains final WEbM file
var blob = new Blob([buffer], { type: "video/webm" });
console.timeEnd("stream");
document.body.appendChild(blobToVideo(blob, width, height, "WebM"));
