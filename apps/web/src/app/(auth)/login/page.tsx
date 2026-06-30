import Link from 'next/link';
import { LoginForm } from '@/components/LoginForm';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <div className="w-full max-w-md">
      <div className="mb-6 flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Leads Portal" className="h-10 w-auto" />
      </div>

      <Card className="shadow-xl">
        <CardHeader className="space-y-1.5 text-center">
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>
            Sign in with a staff or client account to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
          Sign up
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Trouble signing in? Ask your administrator to reset your password.
      </p>
    </div>
  );
}
