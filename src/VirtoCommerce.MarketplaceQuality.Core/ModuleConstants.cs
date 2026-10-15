using System.Collections.Generic;
using VirtoCommerce.Platform.Core.Settings;

namespace VirtoCommerce.MarketplaceQuality.Core;

public static class ModuleConstants
{
    public static class Security
    {
        //public static class Permissions
        //{
        //    public const string Access = "marketplace-quality:access";
        //    public const string Create = "marketplace-quality:create";
        //    public const string Read = "marketplace-quality:read";
        //    public const string Update = "marketplace-quality:update";
        //    public const string Delete = "marketplace-quality:delete";

        //    public static string[] AllPermissions { get; } =
        //    [
        //        Access,
        //        Create,
        //        Read,
        //        Update,
        //        Delete,
        //    ];
        //}
    }

    public static class Settings
    {
        public static class General
        {
            public static SettingDescriptor MarketplaceQualityEnabled { get; } = new()
            {
                Name = "MarketplaceQuality.Enabled",
                GroupName = "MarketplaceQuality|General",
                ValueType = SettingValueType.Boolean,
                DefaultValue = false,
            };

            public static IEnumerable<SettingDescriptor> AllGeneralSettings
            {
                get
                {
                    yield return MarketplaceQualityEnabled;
                }
            }
        }

        public static IEnumerable<SettingDescriptor> AllSettings
        {
            get
            {
                return General.AllGeneralSettings;
            }
        }
    }
}
