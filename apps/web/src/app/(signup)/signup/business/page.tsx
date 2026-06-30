import Link from 'next/link';
import { SignupBusinessForm } from '@/components/SignupBusinessForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SignupBusinessPage() {
  return (
    <div className="w-full max-w-lg">
      <div className="mb-6 flex items-center justify-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-md">
          LP
        </span>
        <span className="text-lg font-semibold tracking-tight">Leads Portal</span>
      </div>

      <Card className="shadow-xl border-0 bg-card/80 backdrop-blur-sm">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl">Business Sign Up</CardTitle>
          <CardDescription>
            Create your agent account. An admin will review and approve your application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignupBusinessForm />
        </CardContent>
      </Card>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
        <span className="mx-2 text-muted-foreground/40">·</span>
        <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
          Back
        </Link>
      </p>
    </div>
  );
}
