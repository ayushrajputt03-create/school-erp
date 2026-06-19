<<<<<<< ours
import LoginForm from '@/components/login-form';

export default function LoginPage() {
  return <main className="mx-auto grid min-h-screen max-w-md place-items-center p-4"><LoginForm /></main>;
=======
'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
  schoolCode: z.string().min(6).max(8),
  emailOrPhone: z.string().min(3),
  password: z.string().min(8)
});

type Form = z.infer<typeof schema>;

export default function LoginPage() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: Form) => {
    console.log('Login payload:', data);
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-md rounded-xl bg-white p-6 shadow">
        <h1 className="text-xl font-semibold">School ERP Login</h1>
        <p className="mb-5 mt-1 text-sm text-slate-500">Use school code + email/phone + password.</p>
        {['schoolCode', 'emailOrPhone', 'password'].map((field) => (
          <div key={field} className="mb-3">
            <input type={field === 'password' ? 'password' : 'text'} placeholder={field} {...register(field as keyof Form)} className="w-full rounded border p-2" />
            <p className="text-xs text-red-600">{errors[field as keyof Form]?.message?.toString()}</p>
          </div>
        ))}
        <button disabled={isSubmitting} className="w-full rounded bg-blue-600 p-2 text-white">{isSubmitting ? 'Signing in...' : 'Sign in'}</button>
      </form>
    </main>
  );
>>>>>>> theirs
}
