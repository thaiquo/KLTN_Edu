import { HomeHeader } from '../../components/home/HomeHeader';
import { MessagesView } from '../../portal/components/MessagesView';

export function StudentMessagesPage() {
  return (
    <div className="min-h-screen bg-bg font-sans text-slate-950">
      <HomeHeader />
      <main className="container-app pb-6 pt-[calc(80px+16px)]">
        <MessagesView embeddedInStudentPage />
      </main>
    </div>
  );
}
