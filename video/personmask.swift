// The person's mask of a talking-head video (Apple Vision person segmentation): white = person, black = background.
//   swift video/personmask.swift in.mp4 mask.mp4
// Raw mask, no blur and no smoothing over time (that made the cut-out lag behind the hands); cutout.py refines it.
import AVFoundation
import CoreImage
import Vision

let args = CommandLine.arguments
let inURL = URL(fileURLWithPath: args[1]), outURL = URL(fileURLWithPath: args[2])
try? FileManager.default.removeItem(at: outURL)

let asset = AVURLAsset(url: inURL)
let track = asset.tracks(withMediaType: .video)[0]
let size = track.naturalSize
let fps = track.nominalFrameRate
let reader = try AVAssetReader(asset: asset)
let rOut = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
reader.add(rOut)
let writer = try AVAssetWriter(outputURL: outURL, fileType: .mp4)
let wIn = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: Int(size.width), AVVideoHeightKey: Int(size.height),
  AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 24_000_000, AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel],
])
wIn.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: wIn, sourcePixelBufferAttributes: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA, kCVPixelBufferWidthKey as String: Int(size.width), kCVPixelBufferHeightKey as String: Int(size.height)])
writer.add(wIn)
reader.startReading(); writer.startWriting(); writer.startSession(atSourceTime: .zero)

let ctx = CIContext(options: [.useSoftwareRenderer: false])
let req = VNGeneratePersonSegmentationRequest()
req.qualityLevel = .accurate
req.outputPixelFormat = kCVPixelFormatType_OneComponent8
var n = 0
let extent = CGRect(origin: .zero, size: size)

while let sample = rOut.copyNextSampleBuffer() {
  guard let pb = CMSampleBufferGetImageBuffer(sample) else { continue }
  let pts = CMSampleBufferGetPresentationTimeStamp(sample)
  let img = CIImage(cvPixelBuffer: pb)
  try VNImageRequestHandler(cvPixelBuffer: pb, options: [:]).perform([req])
  var mask = CIImage(cvPixelBuffer: req.results![0].pixelBuffer)
  mask = mask.transformed(by: CGAffineTransform(scaleX: size.width / mask.extent.width, y: size.height / mask.extent.height))
  let out = mask.applyingFilter("CIColorMatrix", parameters: ["inputRVector": CIVector(x: 1, y: 0, z: 0, w: 0), "inputGVector": CIVector(x: 1, y: 0, z: 0, w: 0), "inputBVector": CIVector(x: 1, y: 0, z: 0, w: 0), "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 1)])

  while !wIn.isReadyForMoreMediaData { usleep(2000) }
  var buf: CVPixelBuffer?
  CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &buf)
  ctx.render(out, to: buf!)
  adaptor.append(buf!, withPresentationTime: pts)
  n += 1
  if n % 90 == 0 { print("\(n) frames") }
}
wIn.markAsFinished()
let sem = DispatchSemaphore(value: 0)
writer.finishWriting { sem.signal() }
sem.wait()
print("Done: \(n) frames at \(fps) fps → \(outURL.path)")
