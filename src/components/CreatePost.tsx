import { useState, useRef } from "react";

type Props = {
  onPost: (text: string, image?: string) => void;
};

export default function CreatePost({ onPost }: Props) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    };

    reader.onerror = () => {
      alert("Failed to read image file");
    };

    reader.readAsDataURL(file);
  };

  const handlePost = () => {
    if (!text.trim() && !image) return;

    onPost(text, image);

    setText("");
    setImage(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeImage = () => {
    setImage(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="bg-white/50 backdrop-blur-xl border border-white/60 rounded-[28px] shadow-xl p-4 mb-6">

      <div className="flex items-center gap-3">

        <div className="w-12 h-12 rounded-full bg-linear-to-r from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
          M
        </div>

        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Drop your vibe 💬"
          className="flex-1 bg-transparent outline-none text-lg text-slate-700 min-w-0"
        />

        <label className="cursor-pointer w-11 h-11 rounded-xl bg-white shadow-md flex items-center justify-center text-xl hover:scale-105 transition shrink-0">
          📸

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImage}
            className="hidden"
          />
        </label>

        <button
          type="button"
          onClick={handlePost}
          disabled={!text.trim() && !image}
          className="bg-linear-to-r from-pink-500 to-pink-600 text-white px-6 py-3 rounded-2xl font-bold shadow-md hover:scale-105 transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          Post it 🔥
        </button>

      </div>

      {image && (
        <div className="mt-4 relative">
          <div className="relative inline-block max-w-full">
            <img
              src={image}
              alt="preview"
              className="rounded-2xl max-h-64 w-full object-cover"
            />
            <button
              type="button"
              onClick={removeImage}
              className="absolute top-3 right-3 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600 transition shadow-lg font-bold"
            >
              ×
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            ✓ Image preview ready
          </p>
        </div>
      )}

    </div>
  );
}