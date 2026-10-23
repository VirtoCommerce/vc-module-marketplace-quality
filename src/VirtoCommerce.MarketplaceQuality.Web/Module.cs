using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using VirtoCommerce.MarketplaceQuality.Core.Services;
using VirtoCommerce.MarketplaceQuality.Data;
using VirtoCommerce.MarketplaceQuality.Data.MySql;
using VirtoCommerce.MarketplaceQuality.Data.PostgreSql;
using VirtoCommerce.MarketplaceQuality.Data.Repositories;
using VirtoCommerce.MarketplaceQuality.Data.Services;
using VirtoCommerce.MarketplaceQuality.Data.SqlServer;
using VirtoCommerce.Platform.Core.Modularity;
using VirtoCommerce.Platform.Core.Settings;
using VirtoCommerce.Platform.Data.MySql.Extensions;
using VirtoCommerce.Platform.Data.PostgreSql.Extensions;
using VirtoCommerce.Platform.Data.SqlServer.Extensions;

namespace VirtoCommerce.MarketplaceQuality.Web;

public class Module : IModule, IHasConfiguration
{
    public ManifestModuleInfo ModuleInfo { get; set; }
    public IConfiguration Configuration { get; set; }

    public void Initialize(IServiceCollection serviceCollection)
    {
        serviceCollection.AddDbContext<MarketplaceQualityDbContext>(options =>
        {
            var databaseProvider = Configuration.GetValue("DatabaseProvider", "SqlServer");
            var connectionString = Configuration.GetConnectionString(ModuleInfo.Id) ?? Configuration.GetConnectionString("VirtoCommerce");

            switch (databaseProvider)
            {
                case "MySql":
                    options.UseMySqlDatabase(connectionString, typeof(MySqlDataAssemblyMarker), Configuration);
                    break;
                case "PostgreSql":
                    options.UsePostgreSqlDatabase(connectionString, typeof(PostgreSqlDataAssemblyMarker), Configuration);
                    break;
                default:
                    options.UseSqlServerDatabase(connectionString, typeof(SqlServerDataAssemblyMarker), Configuration);
                    break;
            }
        });

        serviceCollection.AddTransient<IMarketplaceQualityService, MarketplaceQualityService>();

        serviceCollection.AddMediatR(configuration => configuration.RegisterServicesFromAssemblyContaining<Anchor>());
    }

    public void PostInitialize(IApplicationBuilder appBuilder)
    {
        var serviceProvider = appBuilder.ApplicationServices;

        // Register settings
        //var settingsRegistrar = serviceProvider.GetRequiredService<ISettingsRegistrar>();
        //settingsRegistrar.RegisterSettings(ModuleConstants.Settings.AllSettings, ModuleInfo.Id);

        // Register permissions
        //var permissionsRegistrar = serviceProvider.GetRequiredService<IPermissionsRegistrar>();
        //permissionsRegistrar.RegisterPermissions(ModuleInfo.Id, "MarketplaceQuality", ModuleConstants.Security.Permissions.AllPermissions);

        // Apply migrations
        using var serviceScope = serviceProvider.CreateScope();
        using var dbContext = serviceScope.ServiceProvider.GetRequiredService<MarketplaceQualityDbContext>();
        dbContext.Database.Migrate();
    }

    public void Uninstall()
    {
        // Nothing to do here
    }
}
