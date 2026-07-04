type FollowButtonProps = {
  label: string;
  isFollowing: boolean;
  loading?: boolean;
  onClick: () => void;
  disabled?: boolean;
};

export default function FollowButton({
  label,
  isFollowing,
  loading = false,
  onClick,
  disabled = false,
}: FollowButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold transition shadow-lg ${
        isFollowing
          ? "bg-slate-900 text-white"
          : "bg-linear-to-r from-pink-500 to-purple-500 text-white"
      } ${loading || disabled ? "opacity-60 cursor-not-allowed" : "hover:scale-[1.02]"}`}
    >
      {loading ? "Working..." : label}
    </button>
  );
}
