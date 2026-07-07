import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { getProfile } from "../utils/profileStorage";
import { uploadVideo, type UploadProgress } from "../lib/videoApi";



type Props = {

  onPost: (text: string, image?: string, video?: string, audio?: string, onProgress?: (percent: number) => void) => Promise<boolean>;

};



export default function CreatePost({ onPost }: Props) {

  const [text, setText] = useState("");

  const [image, setImage] = useState<string | undefined>();

  const [video, setVideo] = useState<string | undefined>();

  const [audio, setAudio] = useState<string | undefined>();

  const [isRecording, setIsRecording] = useState(false);

  const [recordingDuration, setRecordingDuration] = useState(0);

  const [isUploading, setIsUploading] = useState(false);

  const [uploadProgress, setUploadProgress] = useState(0);

  const [isPosting, setIsPosting] = useState(false);

  const [postStatus, setPostStatus] = useState<"" | "uploading" | "posting" | "success">(

    ""

  );

  const [isExpanded, setIsExpanded] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const videoInputRef = useRef<HTMLInputElement>(null);

  const audioInputRef = useRef<HTMLInputElement>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);

  const audioChunksRef = useRef<Blob[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);

  const analyserRef = useRef<AnalyserNode | null>(null);

  const animationFrameRef = useRef<number | null>(null);

  const recordingTimerRef = useRef<number | null>(null);



  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {

    setText(e.target.value);



    if (textareaRef.current) {

      textareaRef.current.style.height = "auto";

      textareaRef.current.style.height =

        textareaRef.current.scrollHeight + "px";

    }

  };



  const handleImage = (

    e: React.ChangeEvent<HTMLInputElement>

  ) => {

    const file = e.target.files?.[0];



    if (!file) return;



    // Validate file size (max 5MB)

    if (file.size > 5 * 1024 * 1024) {

      alert("Image must be less than 5MB");

      return;

    }



    // Validate file type

    if (!file.type.startsWith("image/")) {

      alert("Please select a valid image file");

      return;

    }



    const reader = new FileReader();



    reader.onloadend = () => {

      setImage(reader.result as string);

      setVideo(undefined); // Clear video when adding image

    };



    reader.onerror = () => {

      alert("Failed to read image file");

    };



    reader.readAsDataURL(file);

  };



  const handleVideo = async (

    e: React.ChangeEvent<HTMLInputElement>

  ) => {

    const file = e.target.files?.[0];



    if (!file) return;



    // Clear image when adding video

    setImage(undefined);



    setIsUploading(true);

    setPostStatus("uploading");

    const videoUrl = await uploadVideo(file, (progress: UploadProgress) => {

      setUploadProgress(Math.round(progress.percent));

    });



    setIsUploading(false);

    setUploadProgress(0);

    setPostStatus("");



    if (videoUrl) {

      setVideo(videoUrl);

    }

  };



  const handlePost = async () => {

    if (!text.trim() && !image && !video) return;



    setIsPosting(true);

    setPostStatus("posting");



    // Call the onPost callback

    const success = await onPost(text, image, video, undefined, (percent) => {
      setUploadProgress(Math.max(0, Math.min(100, percent)));
    });

    if (!success) {
      setPostStatus("");
      setIsPosting(false);
      return;
    }



    // Simulate brief delay for post creation to be visible

    await new Promise((resolve) => setTimeout(resolve, 500));



    setPostStatus("success");



    // Reset form

    setText("");

    setImage(undefined);

    setVideo(undefined);

    setAudio(undefined);

    setUploadProgress(0);

    if (fileInputRef.current) {

      fileInputRef.current.value = "";

    }

    if (videoInputRef.current) {

      videoInputRef.current.value = "";

    }



    setIsPosting(false);



    // Show success for 1 second, then close

    await new Promise((resolve) => setTimeout(resolve, 1000));

    setPostStatus("");

    closeComposer();

  };



  void handlePost;

  const removeImage = () => {

    setImage(undefined);

    if (fileInputRef.current) {

      fileInputRef.current.value = "";

    }

  };



  const removeVideo = () => {

    setVideo(undefined);

    if (videoInputRef.current) {

      videoInputRef.current.value = "";

    }

  };

  const handleAudio = (e: React.ChangeEvent<HTMLInputElement>) => {

    const file = e.target.files?.[0];

    if (!file) return;

    if (audio) {
      alert("Only one audio attachment is allowed per post.");
      e.target.value = "";
      return;
    }

    // Validate file size (max 10MB for audio)

    if (file.size > 10 * 1024 * 1024) {

      alert("Audio must be less than 10MB");

      return;

    }

    // Validate file type

    if (!file.type.startsWith("audio/")) {

      alert("Please select a valid audio file");

      return;

    }

    // Optimize image in-browser before converting to data URL
    void (async () => {
      try {
        const { optimizeImageFile } = await import("../lib/imageUtils");
        const optimized = await optimizeImageFile(file, 1200, 0.8);
        const reader = new FileReader();
        reader.onloadend = () => {
          setImage(reader.result as string);
          setVideo(undefined); // Clear video when adding image
        };
        reader.onerror = () => {
          alert("Failed to read image file");
        };
        reader.readAsDataURL(optimized as Blob);
      } catch (err) {
        console.warn("Image optimization failed, falling back to original", err);
        const reader = new FileReader();
        reader.onloadend = () => {
          setImage(reader.result as string);
          setVideo(undefined);
        };
        reader.onerror = () => {
          alert("Failed to read image file");
        };
        reader.readAsDataURL(file);
      }
    })();

  };

  const stopWaveformVisualization = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    analyserRef.current = null;

    if (waveCanvasRef.current) {
      const canvasCtx = waveCanvasRef.current.getContext("2d");
      if (canvasCtx) {
        canvasCtx.clearRect(0, 0, waveCanvasRef.current.width, waveCanvasRef.current.height);
      }
    }
  };

  const startWaveformVisualization = (stream: MediaStream) => {
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextCtor) {
      return;
    }

    const audioContext = new AudioContextCtor();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    const drawWaveform = () => {
      const canvas = waveCanvasRef.current;
      const currentAnalyser = analyserRef.current;

      if (!canvas || !currentAnalyser) {
        return;
      }

      const canvasCtx = canvas.getContext("2d");
      if (!canvasCtx) {
        return;
      }

      const width = (canvas.width = canvas.clientWidth || 240);
      const height = (canvas.height = 48);
      const dataArray = new Uint8Array(currentAnalyser.frequencyBinCount);

      currentAnalyser.getByteFrequencyData(dataArray);

      canvasCtx.clearRect(0, 0, width, height);
      
      // Create gradient for vibrant colors
      const gradient = canvasCtx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, "#ec4899");
      gradient.addColorStop(0.5, "#a855f7");
      gradient.addColorStop(1, "#3b82f6");
      
      canvasCtx.fillStyle = gradient;
      canvasCtx.shadowColor = "rgba(236, 72, 153, 0.4)";
      canvasCtx.shadowBlur = 8;
      canvasCtx.lineWidth = 2;
      canvasCtx.beginPath();

      const step = Math.max(1, Math.floor(dataArray.length / width));
      for (let i = 0; i < width; i += 1) {
        const value = dataArray[i * step] ?? 0;
        const barHeight = Math.max(3, (value / 255) * (height - 8));
        const x = i;
        const y = height / 2 - barHeight / 2;
        canvasCtx.fillRect(x, y, 1, barHeight);
      }

      canvasCtx.stroke();
      animationFrameRef.current = window.requestAnimationFrame(drawWaveform);
    };

    drawWaveform();
  };

  const startRecording = async (replaceExisting = false) => {

    if (!replaceExisting && audio) {
      alert("Only one audio attachment is allowed per post.");
      return;
    }

    try {

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const recorder = new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {

        audioChunksRef.current.push(e.data);

      };

      recorder.onstop = () => {

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

        const audioUrl = URL.createObjectURL(audioBlob);

        setAudio(audioUrl);

      };

      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
      }

      setRecordingDuration(0);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingDuration((current) => current + 1);
      }, 1000);

      recorder.start();
      startWaveformVisualization(stream);
      setIsRecording(true);

    } catch (err) {

      alert("Microphone access denied. Please allow microphone permission.");

    }

  };

  const stopRecording = () => {

    if (mediaRecorderRef.current && isRecording) {

      mediaRecorderRef.current.stop();

      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      stopWaveformVisualization();
      setIsRecording(false);

    }

  };

  const removeAudio = () => {

    setAudio(undefined);

    if (audioInputRef.current) {

      audioInputRef.current.value = "";

    }

  };



  const retryRecording = async () => {
    if (isRecording) return;

    removeAudio();
    await startRecording(true);
  };

  const formatRecordingDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
      }
      stopWaveformVisualization();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    };
  }, []);

  const closeComposer = () => {

    setIsExpanded(false);

  };



  const handlePostWithAudio = async () => {

    if (!text.trim() && !image && !video && !audio) return;

    setIsPosting(true);

    setPostStatus("posting");

    // Call the onPost callback with audio
    const success = await onPost(text, image, video, audio, (percent) => {
      setUploadProgress(Math.max(0, Math.min(100, percent)));
    });

    if (!success) {
      setPostStatus("");
      setIsPosting(false);
      return;
    }

    // Simulate brief delay for post creation to be visible
    await new Promise((resolve) => setTimeout(resolve, 500));

    setPostStatus("success");

    // Reset form

    setText("");

    setImage(undefined);

    setVideo(undefined);

    setAudio(undefined);

    setUploadProgress(0);

    if (fileInputRef.current) {

      fileInputRef.current.value = "";

    }

    if (videoInputRef.current) {

      videoInputRef.current.value = "";

    }

    if (audioInputRef.current) {

      audioInputRef.current.value = "";

    }

    setIsPosting(false);

    // Show success for 1 second, then close

    await new Promise((resolve) => setTimeout(resolve, 1000));

    setPostStatus("");

    closeComposer();

  };



  if (!isExpanded) {

    // Collapsed view: minimal composer

    return (

      <div className="bg-white/20 backdrop-blur-3xl border border-white/30 rounded-4xl shadow-2xl p-4 mb-6">

        <div

          className="flex items-center gap-3 cursor-pointer"

          onClick={() => setIsExpanded(true)}

        >

          <div className="w-11 h-11 rounded-2xl bg-linear-to-r from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center text-white font-bold shrink-0">

            M

          </div>



          <div className="flex-1 bg-white/30 px-4 py-3 rounded-2xl text-slate-600 hover:bg-white/40 transition">

            Drop your vibe 💬

          </div>

        </div>

      </div>

    );

  }



  // Expanded view: full composer

  return (

    <>

      {/* Overlay backdrop */}

      <div

        className="fixed inset-0 bg-black/40 z-40"

        onClick={closeComposer}

      />



      {/* Expanded composer card */}

      <div className="fixed inset-4 md:inset-12 lg:inset-24 bg-white/20 backdrop-blur-3xl border border-white/30 rounded-4xl shadow-2xl p-6 z-50 flex flex-col max-h-[90vh] overflow-y-auto">

        {/* Header with close button */}

        <div className="flex items-center justify-between mb-4">

          <h2 className="text-2xl font-bold text-slate-900">Create Post</h2>

          <button

            type="button"

            onClick={closeComposer}

            className="text-3xl text-slate-600 hover:text-slate-900 transition"

          >

            ×

          </button>

        </div>



        {/* Author info */}

        <div className="flex items-center gap-3 mb-6">

          <div className="w-11 h-11 rounded-2xl bg-linear-to-r from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center text-white font-bold shrink-0">

            {(getProfile()?.username ?? "M")[0].toUpperCase()}

          </div>

          <div>

            <p className="font-semibold text-slate-900">{getProfile()?.username ?? "User"}</p>

            <p className="text-sm text-slate-600">Posting to your feed</p>

          </div>

        </div>



        {/* Audio Preview */}

        {audio && (

          <div className="mb-4 flex items-center gap-2 bg-white/30 rounded-2xl p-3 border border-white/40">

            <span>🎵</span>

            <audio src={audio} controls className="flex-1 h-8" />

            <button

              type="button"

              onClick={retryRecording}

              className="rounded-full border border-pink-300 bg-white/80 px-2.5 py-1 text-xs font-semibold text-pink-600 shadow-sm transition hover:bg-pink-50"

            >

              Retry

            </button>

            <button

              type="button"

              onClick={removeAudio}

              className="bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition shadow-lg text-sm font-bold shrink-0"

            >

              ×

            </button>

          </div>

        )}

        {/* Main content area - conditional layout */}

        {image || video ? (

          // Media layout: media on left, textarea on right

          <div className="flex gap-4 mb-4 overflow-hidden">

            {/* Media preview */}

            <div className="shrink-0">

              {image && (

                <div className="relative">

                  <img

                    src={image}

                    alt="preview"

                    className="rounded-2xl w-32 h-32 md:w-40 md:h-40 object-cover"

                  />

                  <button

                    type="button"

                    onClick={removeImage}

                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition shadow-lg text-sm font-bold"

                  >

                    ×

                  </button>

                </div>

              )}

              {video && (

                <div className="relative">

                  <video

                    src={video}

                    className="rounded-2xl w-32 h-32 md:w-40 md:h-40 object-cover"

                  />

                  <button

                    type="button"

                    onClick={removeVideo}

                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition shadow-lg text-sm font-bold"

                  >

                    ×

                  </button>

                </div>

              )}

            </div>



            {/* Textarea on right */}

            <textarea

              ref={textareaRef}

              value={text}

              onChange={handleTextChange}

              placeholder="Drop your vibe 💬"

              className="flex-1 bg-white/50 border border-white/40 rounded-2xl outline-none text-base md:text-lg text-slate-700 p-3 md:p-4 resize-none min-h-32 max-h-40 overflow-y-auto focus:border-pink-400 focus:ring-1 focus:ring-pink-400"

            />

          </div>

        ) : (

          // No media: textarea full width

          <textarea

            ref={textareaRef}

            value={text}

            onChange={handleTextChange}

            placeholder="Drop your vibe 💬"

            className="w-full bg-white/50 border border-white/40 rounded-2xl outline-none text-lg text-slate-700 p-4 resize-none min-h-32 max-h-80 overflow-y-auto mb-4 focus:border-pink-400 focus:ring-1 focus:ring-pink-400"

          />

        )}



        {/* Audio Preview */}

        {audio && (

          <div className="mb-4 flex items-center gap-2 bg-white/30 rounded-2xl p-3 border border-white/40">

            <span>🎵</span>

            <audio src={audio} controls className="flex-1 h-8" />

            <button

              type="button"

              onClick={removeAudio}

              className="bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition shadow-lg text-sm font-bold shrink-0"

            >

              ×

            </button>

          </div>

        )}

        {isRecording && (

          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-2xl">

            <div className="flex items-center justify-between gap-3">

              <div className="flex items-center gap-2">

                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />

                <p className="text-sm font-semibold text-red-700">Recording in progress...</p>

                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                  {formatRecordingDuration(recordingDuration)}
                </span>

              </div>

              <button

                type="button"

                onClick={stopRecording}

                className="rounded-full bg-red-500 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600"

              >

                ⏹ Stop

              </button>

            </div>

            <canvas ref={waveCanvasRef} className="mt-3 h-10 w-full rounded-xl bg-slate-900/90" />

          </div>

        )}

        {/* Upload Progress */}

        {isUploading && (

          <div className="mb-4">

            <div className="flex items-center justify-between mb-2">

              <p className="text-sm text-slate-600">Uploading...</p>

              <p className="text-sm text-slate-600 font-semibold">

                {uploadProgress}%

              </p>

            </div>

            <div className="w-full bg-slate-200 rounded-full h-2">

              <div

                className="bg-linear-to-r from-pink-500 to-purple-500 h-2 rounded-full transition-all duration-300"

                style={{ width: `${uploadProgress}%` }}

              />

            </div>

          </div>

        )}



        {/* Status Messages */}

        {postStatus === "posting" && (

          <div className="mb-4 p-3 bg-blue-100 border border-blue-300 rounded-2xl text-center">

            <p className="text-sm font-semibold text-blue-700">Creating post...</p>

          </div>

        )}



        {postStatus === "success" && (

          <div className="mb-4 p-3 bg-green-100 border border-green-300 rounded-2xl text-center">

            <p className="text-sm font-semibold text-green-700">✓ Post created successfully!</p>

          </div>

        )}



        {/* Controls */}

        <div className="flex flex-col md:flex-row items-center gap-3 justify-between">

          <div className="flex items-center gap-3">

            <label className="cursor-pointer w-11 h-11 rounded-xl bg-white shadow-md flex items-center justify-center text-xl hover:scale-105 transition">

              📸

              <input

                ref={fileInputRef}

                type="file"

                accept="image/*"

                onChange={handleImage}

                disabled={isUploading || !!video}

                className="hidden"

              />

            </label>



            <button

              type="button"

              onClick={() => {
                if (isRecording) {
                  stopRecording();
                } else {
                  void startRecording();
                }
              }}

              disabled={Boolean(audio) && !isRecording}

              className={`h-11 w-11 rounded-full shadow-md flex items-center justify-center shrink-0 transition ${

                isRecording

                  ? "bg-red-500 text-white shadow-lg shadow-red-500/40 animate-pulse scale-105"

                  : "bg-blue-500 text-white hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-500/30 active:scale-95"

              } ${Boolean(audio) && !isRecording ? "opacity-50 cursor-not-allowed" : ""}`}

              title={isRecording ? "Stop recording" : "Record voice"}

            >

              {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}

            </button>

            <label
              className={`w-11 h-11 rounded-xl bg-white shadow-md flex items-center justify-center text-xl hover:scale-105 transition ${Boolean(audio) ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              title={audio ? "Audio already selected" : "Upload audio"}
              onClick={(e) => {
                if (audio) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
            >

              🎵

              <input

                ref={audioInputRef}

                type="file"

                accept="audio/*"

                onChange={handleAudio}

                disabled={isUploading || isRecording || Boolean(audio)}

                className="hidden"

              />

            </label>

            <label className={`w-11 h-11 rounded-xl bg-white shadow-md flex items-center justify-center text-xl hover:scale-105 transition ${audio ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`} title={audio ? "Remove audio to upload video" : "Upload video"} onClick={(e) => { if (audio) { e.preventDefault(); e.stopPropagation(); } }}>

              🎬

              <input

                ref={videoInputRef}

                type="file"

                accept="video/mp4,video/webm,video/quicktime"

                onChange={handleVideo}

                disabled={isUploading || !!image || Boolean(audio)}

                className="hidden"

              />

            </label>

          </div>



          <div className="flex items-center gap-3 w-full md:w-auto">

            <button

              type="button"

              onClick={closeComposer}

              className="flex-1 md:flex-none px-6 py-3 rounded-2xl font-bold shadow-md hover:scale-105 transition bg-white text-slate-700"

            >

              Cancel

            </button>



            <button

              type="button"

              onClick={handlePostWithAudio}

              disabled={(!text.trim() && !image && !video && !audio) || isUploading || isPosting || isRecording}

              className="flex-1 md:flex-none bg-linear-to-r from-pink-500 to-pink-600 text-white px-6 py-3 rounded-2xl font-bold shadow-md hover:scale-105 transition disabled:opacity-50 disabled:cursor-not-allowed"

            >

              Post it 🔥

            </button>

          </div>

        </div>

      </div>

    </>

  );

} 

