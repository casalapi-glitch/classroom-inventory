export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <section className="w-full max-w-3xl bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900">
            School Classroom Inventory Tracker
          </h1>

          <p className="mt-4 text-xl text-gray-700">
            A simple system for tracking classroom items, rooms, buildings,
            and inventory reports.
          </p>
        </div>

        <div className="mt-10 grid gap-5">
          <a
            href="/login"
            className="block text-center rounded-xl bg-blue-700 px-6 py-5 text-2xl font-semibold text-white hover:bg-blue-800"
          >
            Login
          </a>

          <a
            href="/teacher"
            className="block text-center rounded-xl bg-green-700 px-6 py-5 text-2xl font-semibold text-white hover:bg-green-800"
          >
            Teacher Dashboard
          </a>

          <a
            href="/admin"
            className="block text-center rounded-xl bg-purple-700 px-6 py-5 text-2xl font-semibold text-white hover:bg-purple-800"
          >
            Admin Dashboard
          </a>
        </div>

        <p className="mt-8 text-center text-lg text-gray-600">
          Designed with large text, simple buttons, and easy navigation for all teachers.
        </p>
      </section>
    </main>
  );
}