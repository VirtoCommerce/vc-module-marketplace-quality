using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using VirtoCommerce.MarketplaceQuality.Data.Repositories;

namespace VirtoCommerce.MarketplaceQuality.Data.PostgreSql;

public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<MarketplaceQualityDbContext>
{
    public MarketplaceQualityDbContext CreateDbContext(string[] args)
    {
        var builder = new DbContextOptionsBuilder<MarketplaceQualityDbContext>();
        var connectionString = args.Length != 0 ? args[0] : "Server=localhost;Username=virto;Password=virto;Database=VirtoCommerce3;";

        builder.UseNpgsql(
            connectionString,
            options => options.MigrationsAssembly(typeof(PostgreSqlDataAssemblyMarker).Assembly.GetName().Name));

        return new MarketplaceQualityDbContext(builder.Options);
    }
}
