export default function PendingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md rounded-xl border p-6 text-center">
        <h1 className="text-2xl font-semibold">Approval Pending</h1>
        <p className="mt-2 text-zinc-600">Your account is awaiting admin approval. Please check back soon.</p>
      </div>
    </div>
  );
}
