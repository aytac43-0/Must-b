import { LucideIcon } from "lucide-react";

interface PlaceholderPageProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export default function PlaceholderPage({ icon: Icon, title, description }: PlaceholderPageProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full text-center px-8">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-2xl" />
        <div className="relative w-20 h-20 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex items-center justify-center">
          <Icon size={36} className="text-orange-400" />
        </div>
      </div>
      <h2 className="text-3xl font-bold text-white mb-3">{title}</h2>
      <p className="text-gray-400 text-lg max-w-md leading-relaxed">{description}</p>
      <div className="mt-8 px-6 py-3 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-400 text-sm font-medium">
        Coming soon — actively in development
      </div>
    </div>
  );
}
