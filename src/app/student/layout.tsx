import ClientLayout from './ClientLayout';

export const dynamic = 'force-dynamic';

export default function StudentLayoutServer({ children }: { children: React.ReactNode }) {
    return <ClientLayout>{children}</ClientLayout>;
}
