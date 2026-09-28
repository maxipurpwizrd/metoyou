import { useEffect, useRef, useState } from "react";
import { useSession } from "../contexts/SessionContext";
import { uploadVideo, type UploadProgress } from "../lib/videoApi";
import { optimizeImageFile } from "../lib/imageUtils";
import { optimizeVoiceNote } from "../lib/mediaOptimizer";



type Props = {

  onPost: (text: string, image?: string, video?: string, audio?: string, onProgress?: (percent: number) => void, originalImage?: string) => Promise<boolean>;

};



export default function CreatePost({ onPost }: Props) {
  const { profile } = useSession();

  const [text, setText] = useState("");

  const [image, setImage] = useState<string | undefined>();

  const [originalImage, setOriginalImage] = useState<string | undefined>();
  const [video, setVideo] = useState<string | undefined>();
  const [audio, setAudio] = useState<string | undefined>();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isPosting, setIsPosting] = useState(false);
  const [postStatus, setPostStatus] = useState<"" | "uploading" | "posting" | "success">("");
  const [composerNotice, setComposerNotice] = useState<{ type: "error" | "info"; message: string } | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
    setComposerNotice(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setComposerNotice({ type: "error", message: "Image must be less than 5MB" });
      return;
    }
    if (!file.type.startsWith("image/")) {
      setComposerNotice({ type: "error", message: "Please select a valid image file" });
      return;
    }

    void (async () => {
      try {
        const optimized = await optimizeImageFile(file, 1080, 0.8, 300 * 1024);
        const readAsDataUrl = (source: Blob) => new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to read image file"));
          reader.readAsDataURL(source);
        });
        const [optimizedDataUrl, originalDataUrl] = await Promise.all([
          readAsDataUrl(optimized),
          readAsDataUrl(file),
        ]);
        setImage(optimizedDataUrl);
        setOriginalImage(originalDataUrl);
        setVideo(undefined);
      } catch (error) {
        console.warn("Image optimization failed", error);
        setComposerNotice({ type: "error", message: "Image could not be compressed. Please choose a smaller image." });
      }
    })();
  };

  const handleVideo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImage(undefined);
    setIsUploading(true);
    setPostStatus("uploading");
    const videoUrl = await uploadVideo(file, (progress: UploadProgress) => {
      setUploadProgress(Math.round(progress.percent));
    });
    setIsUploading(false);
    setUploadProgress(0);
    setPostStatus("");
    if (videoUrl) setVideo(videoUrl);
  };

  const handlePost = async () => {
    if (!text.trim() && !image && !video) return;
    setIsPosting(true);
    setPostStatus("posting");
    const success = await onPost(text, image, video, undefined, (percent) => {
      setUploadProgress(Math.max(0, Math.min(100, percent)));
    }, originalImage);
    setOriginalImage(undefined);
    if (!success) {
      setPostStatus("");
      setIsPosting(false);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    setPostStatus("success");
    setText("");
    setImage(undefined);
    setVideo(undefined);
    setAudio(undefined);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (videoInputRef.current) videoInputRef.current.value = "";
    setIsPosting(false);
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
      setComposerNotice({ type: "error", message: "Only one audio attachment is allowed per post." });
      e.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setComposerNotice({ type: "error", message: "Audio must be less than 10MB" });
      return;
    }

    if (!file.type.startsWith("audio/")) {
      setComposerNotice({ type: "error", message: "Please select a valid audio file" });
      return;
    }

    void (async () => {
      try {
        const optimized = await optimizeVoiceNote(file, 5 * 1024 * 1024);
        const reader = new FileReader();
        reader.onloadend = () => {
          setAudio(reader.result as string);
          setVideo(undefined);
        };
        reader.onerror = () => {
          setComposerNotice({ type: "error", message: "Failed to read audio file" });
        };
        reader.readAsDataURL(optimized);
      } catch (err) {
        console.warn("Audio optimization failed", err);
        setComposerNotice({ type: "error", message: "Voice note could not be compressed. Please choose a smaller recording." });
      }
    })();

  };

  const removeAudio = () => {

    setAudio(undefined);

    if (audioInputRef.current) {

      audioInputRef.current.value = "";

    }

  };



  useEffect(() => {
    if (!isExpanded) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isExpanded]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("metoyou:create-post-visibility", { detail: isExpanded }));
  }, [isExpanded]);

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
    }, originalImage);
  setOriginalImage(undefined);

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

      <div className="mx-1 sm:mx-2 bg-white/20 backdrop-blur-3xl border border-white/30 rounded-4xl shadow-2xl p-4 mb-6">

        <div

          className="flex items-center gap-3 cursor-pointer"

          onClick={() => setIsExpanded(true)}

        >

          <div className="w-11 h-11 rounded-2xl bg-linear-to-r from-sky-500 via-cyan-400 to-blue-500 flex items-center justify-center text-white font-bold shrink-0">

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

        className="fixed inset-0 z-100 bg-black/40 backdrop-blur-md"

        onClick={closeComposer}

      />



      {/* Expanded composer card */}

      <div className="fixed inset-4 md:inset-12 lg:inset-24 z-101 flex max-h-[90vh] flex-col overflow-y-auto rounded-4xl border border-white/30 bg-white/20 p-6 shadow-2xl backdrop-blur-3xl">
        {composerNotice ? (
          <div className={`mb-4 rounded-2xl border px-3 py-2 text-sm font-medium ${composerNotice.type === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-sky-200 bg-sky-50 text-sky-700"}`}>
            {composerNotice.message}
          </div>
        ) : null}

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

          <div className="w-11 h-11 rounded-2xl bg-linear-to-r from-sky-500 via-cyan-400 to-blue-500 flex items-center justify-center text-white font-bold shrink-0">

            {(profile?.username ?? "M")[0].toUpperCase()}

          </div>

          <div>

            <p className="font-semibold text-slate-900">{profile?.username ?? "User"}</p>

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

              className="flex-1 bg-white/50 border border-white/40 rounded-2xl outline-none text-base md:text-lg text-slate-700 p-3 md:p-4 resize-none min-h-32 max-h-40 overflow-y-auto focus:border-sky-400 focus:ring-1 focus:ring-sky-400"

            />

          </div>

        ) : (

          // No media: textarea full width

          <textarea

            ref={textareaRef}

            value={text}

            onChange={handleTextChange}

            placeholder="Drop your vibe 💬"

            className="w-full bg-white/50 border border-white/40 rounded-2xl outline-none text-lg text-slate-700 p-4 resize-none min-h-32 max-h-80 overflow-y-auto mb-4 focus:border-sky-400 focus:ring-1 focus:ring-sky-400"

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

                className="bg-linear-to-r from-sky-500 to-cyan-500 h-2 rounded-full transition-all duration-300"

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



            <label
              className={`w-11 h-11 rounded-xl bg-white shadow-md flex items-center justify-center text-xl hover:scale-105 transition ${audio ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
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

                disabled={isUploading || Boolean(audio)}

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

              disabled={(!text.trim() && !image && !video && !audio) || isUploading || isPosting}

              className="flex-1 md:flex-none bg-linear-to-r from-sky-500 to-cyan-500 text-white px-6 py-3 rounded-2xl font-bold shadow-md hover:scale-105 transition disabled:opacity-50 disabled:cursor-not-allowed"

            >

              Post it 🔥

            </button>

          </div>

        </div>

      </div>

    </>

  );

} 

