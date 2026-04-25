import { prisma } from "@crm/db";

export interface CplRow {
  campaignId: string;
  campaignName: string | null;
  platform: string;
  totalSpend: number;
  clicks: number;
  leads: number;
  cpl: number | null;
}

export interface RoasRow {
  campaignId: string;
  campaignName: string | null;
  platform: string;
  totalSpend: number;
  totalRevenue: number;
  conversions: number;
  roas: number | null;
}

export interface ConversionFunnel {
  totalLeads: number;
  qualifiedLeads: number;
  conversions: number;
  totalRevenue: number;
  conversionRate: number; // percent
}

export async function getCplByCampaign(
  tenantId: string,
  dateFrom: Date,
  dateTo: Date,
): Promise<CplRow[]> {
  const spends = await prisma.campaignSpend.findMany({
    where: { tenantId, date: { gte: dateFrom, lte: dateTo } },
    select: { campaignId: true, campaignName: true, platform: true, spend: true, clicks: true },
  });

  // Aggregate by campaignId
  const map = new Map<string, { campaignName: string | null; platform: string; spend: number; clicks: number }>();
  for (const row of spends) {
    const existing = map.get(row.campaignId);
    if (existing) {
      existing.spend += row.spend;
      existing.clicks += row.clicks;
    } else {
      map.set(row.campaignId, {
        campaignName: row.campaignName,
        platform: row.platform,
        spend: row.spend,
        clicks: row.clicks,
      });
    }
  }

  const results: CplRow[] = [];
  for (const [campaignId, agg] of map) {
    const leads = await prisma.lead.count({
      where: {
        tenantId,
        createdAt: { gte: dateFrom, lte: dateTo },
        attribution: { fbclid: { not: null } },
      },
    });

    results.push({
      campaignId,
      campaignName: agg.campaignName,
      platform: agg.platform,
      totalSpend: agg.spend,
      clicks: agg.clicks,
      leads,
      cpl: leads > 0 ? agg.spend / leads : null,
    });
  }

  return results;
}

export async function getRoasByCampaign(
  tenantId: string,
  dateFrom: Date,
  dateTo: Date,
): Promise<RoasRow[]> {
  const spends = await prisma.campaignSpend.findMany({
    where: { tenantId, date: { gte: dateFrom, lte: dateTo } },
    select: { campaignId: true, campaignName: true, platform: true, spend: true, clicks: true },
  });

  const map = new Map<string, { campaignName: string | null; platform: string; spend: number }>();
  for (const row of spends) {
    const existing = map.get(row.campaignId);
    if (existing) {
      existing.spend += row.spend;
    } else {
      map.set(row.campaignId, { campaignName: row.campaignName, platform: row.platform, spend: row.spend });
    }
  }

  const purchases = await prisma.conversionEvent.findMany({
    where: {
      tenantId,
      eventType: "purchase",
      status: "success",
      sentAt: { gte: dateFrom, lte: dateTo },
    },
    select: { value: true, leadId: true },
  });

  const totalRevenue = purchases.reduce((sum, e) => sum + (e.value ?? 0), 0);

  const results: RoasRow[] = [];
  for (const [campaignId, agg] of map) {
    results.push({
      campaignId,
      campaignName: agg.campaignName,
      platform: agg.platform,
      totalSpend: agg.spend,
      totalRevenue,
      conversions: purchases.length,
      roas: agg.spend > 0 ? totalRevenue / agg.spend : null,
    });
  }

  return results;
}

export async function getConversionFunnel(
  tenantId: string,
  dateFrom: Date,
  dateTo: Date,
): Promise<ConversionFunnel> {
  const dateFilter = { gte: dateFrom, lte: dateTo };

  const [totalLeads, qualifiedLeads, purchases] = await Promise.all([
    prisma.lead.count({ where: { tenantId, createdAt: dateFilter } }),
    prisma.lead.count({ where: { tenantId, createdAt: dateFilter, score: { gte: 60 } } }),
    prisma.conversionEvent.findMany({
      where: { tenantId, eventType: "purchase", status: "success", sentAt: dateFilter },
      select: { value: true },
    }),
  ]);

  const conversions = purchases.length;
  const totalRevenue = purchases.reduce((sum, e) => sum + (e.value ?? 0), 0);
  const conversionRate = totalLeads > 0 ? (conversions / totalLeads) * 100 : 0;

  return { totalLeads, qualifiedLeads, conversions, totalRevenue, conversionRate };
}
