'use client';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({ schoolCode: z.string().min(6).max(8), identifier: z.string().min(3), password: z.string().min(8) });
type FormData = z.infer<typeof schema>;

export default function LoginForm() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });
  const onSubmit = async (data: FormData) => {
    const res = await fetch('/api/auth/login', { method: 'POST', body: JSON.stringify(data) });
    if (res.ok) router.push('/dashboard');
    else alert('Invalid credentials');
  };
  return <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-2xl bg-white p-6 shadow"><h1 className="text-2xl font-semibold text-brand-600">School ERP Login</h1><input placeholder="School code" className="w-full rounded border p-2" {...register('schoolCode')} /><p className="text-xs text-red-600">{errors.schoolCode?.message}</p><input placeholder="Email or Phone" className="w-full rounded border p-2" {...register('identifier')} /><p className="text-xs text-red-600">{errors.identifier?.message}</p><input type="password" placeholder="Password" className="w-full rounded border p-2" {...register('password')} /><p className="text-xs text-red-600">{errors.password?.message}</p><button disabled={isSubmitting} className="w-full rounded bg-brand-500 p-2 text-white">{isSubmitting ? 'Signing in...' : 'Sign in'}</button></form>;
}
