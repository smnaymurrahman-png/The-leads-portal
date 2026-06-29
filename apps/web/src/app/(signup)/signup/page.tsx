import Link from 'next/link';
import { Building2, UserCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SignupPage() {
  return (
    <div className="w-full max-w-lg">
      <div className="mb-8 flex items-center justify-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-sm">
          LP
        </span>
        <span className="text-base font-semibold tracking-tight">Leads Portal</span>
      </div>

      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Create an account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Choose which portal you&apos;d like to sign up for</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/signup/business">
          <Card className="h-full cursor-pointer transition-all hover:border-primary/50 hover:shadow-md">
            <CardHeader className="pb-3">
              <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="size-5 text-primary" />
              </div>
              <CardTitle className="text-lg">Business Portal</CardTitle>
              <CardDescription>
                For agents and business owners who manage clients and campaigns.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Account requires admin approval before access is granted.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/signup/client">
          <Card className="h-full cursor-pointer transition-all hover:border-primary/50 hover:shadow-md">
            <CardHeader className="pb-3">
              <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                <UserCheck className="size-5 text-primary" />
              </div>
              <CardTitle className="text-lg">Client Portal</CardTitle>
              <CardDescription>
                For buyers who want to purchase and manage leads.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                You will need an Agent ID provided by your agent.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
