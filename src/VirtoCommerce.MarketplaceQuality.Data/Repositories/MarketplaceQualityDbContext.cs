using System.Reflection;
using Microsoft.EntityFrameworkCore;
//using VirtoCommerce.Platform.Data.Extensions;
using VirtoCommerce.Platform.Data.Infrastructure;

namespace VirtoCommerce.MarketplaceQuality.Data.Repositories;

public class MarketplaceQualityDbContext : DbContextBase
{
    public MarketplaceQualityDbContext(DbContextOptions<MarketplaceQualityDbContext> options)
        : base(options)
    {
    }

    protected MarketplaceQualityDbContext(DbContextOptions options)
        : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        //modelBuilder.Entity<BazQuxEntity>().ToAuditableEntityTable("BazQux");

        switch (Database.ProviderName)
        {
            case "Pomelo.EntityFrameworkCore.MySql":
                modelBuilder.ApplyConfigurationsFromAssembly(Assembly.Load("VirtoCommerce.MarketplaceQuality.Data.MySql"));
                break;
            case "Npgsql.EntityFrameworkCore.PostgreSQL":
                modelBuilder.ApplyConfigurationsFromAssembly(Assembly.Load("VirtoCommerce.MarketplaceQuality.Data.PostgreSql"));
                break;
            case "Microsoft.EntityFrameworkCore.SqlServer":
                modelBuilder.ApplyConfigurationsFromAssembly(Assembly.Load("VirtoCommerce.MarketplaceQuality.Data.SqlServer"));
                break;
        }
    }
}
