"use server";

import { db } from "@/db";
import { assets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function addAsset(data: {
  name: string;
  amount: number;
  avgBuyPrice: number;
  currentPrice: number;
}) {
  await db.insert(assets).values({
    name: data.name.toUpperCase(),
    amount: data.amount,
    avgBuyPrice: data.avgBuyPrice,
    currentPrice: data.currentPrice,
  });
  revalidatePath("/");
  revalidatePath("/investments");
}

export async function updateAsset(
  id: number,
  data: Partial<{
    name: string;
    amount: number;
    avgBuyPrice: number;
    currentPrice: number;
  }>
) {
  await db
    .update(assets)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(assets.id, id));
  revalidatePath("/");
  revalidatePath("/investments");
}

export async function deleteAsset(id: number) {
  await db.delete(assets).where(eq(assets.id, id));
  revalidatePath("/");
  revalidatePath("/investments");
}

export async function getAllAssets() {
  return db.select().from(assets);
}

export async function getInvestmentSummary() {
  const allAssets = await db.select().from(assets);

  const totalValue = allAssets.reduce(
    (sum, a) => sum + a.amount * a.currentPrice,
    0
  );
  const totalCost = allAssets.reduce(
    (sum, a) => sum + a.amount * a.avgBuyPrice,
    0
  );
  const totalPnL = totalValue - totalCost;
  const pnlPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  const btcAsset = allAssets.find((a) => a.name === "BTC");

  return {
    totalValue,
    totalCost,
    totalPnL,
    pnlPercent: Math.round(pnlPercent * 100) / 100,
    btcHoldings: btcAsset ? btcAsset.amount : null,
    btcValue: btcAsset ? btcAsset.amount * btcAsset.currentPrice : null,
    assets: allAssets,
  };
}
