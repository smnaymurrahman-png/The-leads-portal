import Link from 'next/link';
import { SignupBusinessForm } from '@/components/SignupBusinessForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SignupBusinessPage() {
  return (
    <div className="w-full max-w-md">
      <div className="mb-6 flex items-center justify-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-sm">
          LP
        </span>
        <span className="text-base font-semibold tracking-tight">Leads Portal</span>
      </div>

      <Card className="shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl">Business Sign Up</CardTitle>
          <CardDescription>
            Create a business account. An admin will review and approve your application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignupBusinessForm />
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
        {' · '}
        <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
          Back
        </Link>
      </p>
    </div>
  );
}
