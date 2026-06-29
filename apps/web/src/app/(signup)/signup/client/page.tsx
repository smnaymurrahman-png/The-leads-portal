import Link from 'next/link';
import { SignupClientForm } from '@/components/SignupClientForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SignupClientPage() {
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
          <CardTitle className="text-2xl">Client Sign Up</CardTitle>
          <CardDescription>
            Create a client account. Your agent will approve your request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignupClientForm />
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
