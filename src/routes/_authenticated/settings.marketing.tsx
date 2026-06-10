import { createFileRoute } from '@tanstack/react-router'
import { createFileRoute } from "@/lib/router";
import { useEffect, useState } from "react";
import { Plus, Megaphone, Coins, Loader2, Power } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  fetchAllPlatforms,
  fetchCurrencies,
  type MarketingPlatform,
  type Currency,
} from "@/lib/marketing";

export const Route = createFileRoute("/_authenticated/settings/marketing")({
  head: () => ({ meta: [{ title: "Marketing Setup — Motion IT BD" }] }),
  component: MarketingSetup,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function MarketingSetup() {
  const { isAdmin, user } = useAuth();
  const [platforms, setPlatforms] = useState<MarketingPlatform[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);

  const [platformName, setPlatformName] = useState("");
  const [curCode, setCurCode] = useState("");
  const [curName, setCurName] = useState("");
  const [curSymbol, setCurSymbol] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [p, c] = await Promise.all([fetchAllPlatforms(), fetchCurrencies(true)]);
    setPlatforms(p);
    setCurrencies(c);
    setLoading(false);
  }

  useEffect(() => {
    load().catch((e) => {
      toast.error(e instanceof Error ? e.message : "Failed to load.");
      setLoading(false);
    });
  }, []);

  if (!isAdmin) {
    return (
      <div className="space-y-8">
        <PageHeader title="Marketing Setup" />
        <NoAccess />
      </div>
    );
  }

  async function addPlatform(e: React.FormEvent) {
    e.preventDefault();
    const name = platformName.trim();
    if (!name) return;
    setBusy(true);
    const { error } = await db.from("marketing_platforms").insert({
      name,
      sort_order: platforms.length,
      created_by: user?.id ?? null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPlatformName("");
    toast.success("Platform added.");
    load();
  }

  async function togglePlatform(p: MarketingPlatform) {
    const { error } = await db
      .from("marketing_platforms")
      .update({ is_active: !p.is_active })
      .eq("id", p.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    load();
  }

  async function addCurrency(e: React.FormEvent) {
    e.preventDefault();
    const code = curCode.trim().toUpperCase();
    const name = curName.trim();
    if (!code || !name) return;
    setBusy(true);
    const { error } = await db.from("currencies").insert({
      code,
      name,
      symbol: curSymbol.trim() || null,
      sort_order: currencies.length,
      created_by: user?.id ?? null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCurCode("");
    setCurName("");
    setCurSymbol("");
    toast.success("Currency added.");
    load();
  }

  async function toggleCurrency(c: Currency) {
    const { error } = await db.from("currencies").update({ is_active: !c.is_active }).eq("id", c.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    load();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Marketing Setup"
        description="Manage marketing platforms and supported currencies. Foreign currencies always convert to BDT."
      />

      {loading ? (
        <Skeleton className="h-96 w-full rounded-lg" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Platforms */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Megaphone className="h-4 w-4 text-brand" /> Platforms
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={addPlatform} className="flex items-end gap-2">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="pf-name">New platform</Label>
                  <Input
                    id="pf-name"
                    value={platformName}
                    maxLength={100}
                    onChange={(e) => setPlatformName(e.target.value)}
                    placeholder="e.g. LinkedIn Ads"
                  />
                </div>
                <Button type="submit" disabled={busy || !platformName.trim()}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add
                </Button>
              </form>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-16 text-right">Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {platforms.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>
                        <Badge variant={p.is_active ? "secondary" : "outline"} className="text-[10px]">
                          {p.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Switch checked={p.is_active} onCheckedChange={() => togglePlatform(p)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Currencies */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Coins className="h-4 w-4 text-brand" /> Currencies
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={addCurrency} className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:items-end">
                <div className="space-y-2">
                  <Label htmlFor="cur-code">Code</Label>
                  <Input
                    id="cur-code"
                    value={curCode}
                    maxLength={6}
                    onChange={(e) => setCurCode(e.target.value)}
                    placeholder="USD"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cur-name">Name</Label>
                  <Input
                    id="cur-name"
                    value={curName}
                    maxLength={60}
                    onChange={(e) => setCurName(e.target.value)}
                    placeholder="US Dollar"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cur-sym">Symbol</Label>
                  <Input
                    id="cur-sym"
                    value={curSymbol}
                    maxLength={6}
                    onChange={(e) => setCurSymbol(e.target.value)}
                    placeholder="$"
                  />
                </div>
                <Button type="submit" disabled={busy || !curCode.trim() || !curName.trim()}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add
                </Button>
              </form>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-16 text-right">Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currencies.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        {c.symbol ? `${c.symbol} ` : ""}{c.code}
                      </TableCell>
                      <TableCell>{c.name}</TableCell>
                      <TableCell className="text-right">
                        <Switch
                          checked={c.is_active}
                          disabled={c.code === "BDT"}
                          onCheckedChange={() => toggleCurrency(c)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground">
                <Power className="mr-1 inline h-3 w-3" />
                BDT is the base reporting currency and can't be disabled.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
