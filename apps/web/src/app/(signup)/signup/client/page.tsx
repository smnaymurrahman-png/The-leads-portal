import Link from 'next/link';
import { SignupClientForm } from '@/components/SignupClientForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SignupClientPage() {
  return (
    <div className="w-full max-w-lg">
      <div className="mb-6 flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Leads Portal" className="h-10 w-auto" />
      </div>

      <Card className="shadow-xl border-0 bg-card/80 backdrop-blur-sm">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl">Client Sign Up</CardTitle>
          <CardDescription>
            Create a client account. Your agent will review and approve your request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignupClientForm />
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
