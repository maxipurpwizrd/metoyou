import {
  Users,
  MessageCircle,
  Globe,
  Sparkles,
} from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Family Link",
    description:
      "Keep your family close no matter where life takes you.",
  },
  {
    icon: MessageCircle,
    title: "Real Talk",
    description:
      "Chat, voice notes, and video calls with your people.",
  },
  {
    icon: Globe,
    title: "Communities",
    description:
      "Find your tribe and connect with people who share your interests.",
  },
  {
    icon: Sparkles,
    title: "Moments",
    description:
      "Share memories, photos, stories, and experiences.",
  },
];

export default function Features() {
  return (
    <section className="py-24 px-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-4xl font-bold text-center mb-4">
          Why People Rock With MeToYou
        </h2>

        <p className="text-center text-gray-600 mb-14">
          More than social media. A place to connect, share, and grow together.
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <div
                key={feature.title}
                className="bg-white p-6 rounded-2xl shadow-sm border hover:shadow-md transition"
              >
                <Icon size={36} />

                <h3 className="text-xl font-semibold mt-4 mb-2">
                  {feature.title}
                </h3>

                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}