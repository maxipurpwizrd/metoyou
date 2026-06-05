import CreatePost from "../components/CreatePost";
import PostCard from "../components/PostCard";

export default function Feed() {
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-4xl font-bold mb-6">
        Yo 👋 What's Good?
      </h1>

      <CreatePost />

      <PostCard
        name="Jessica"
        time="2 mins ago"
        text="Just had the best day ever ✨"
      />

      <PostCard
        name="Mike"
        time="15 mins ago"
        text="Anybody tryna link up this weekend? 🔥"
      />

      <PostCard
        name="Sarah"
        time="1 hour ago"
        text="Family time is the best time ❤️"
      />
    </div>
  );
}