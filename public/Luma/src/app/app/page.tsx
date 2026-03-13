import { Suspense } from "react";
import { ChatArea } from "@/components/chat-area";

export default function AppPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ChatArea />
        </Suspense>
    );
}
