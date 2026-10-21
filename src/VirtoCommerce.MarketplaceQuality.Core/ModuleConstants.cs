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
            public static readonly SettingDescriptor MarketplaceQualityTargets = new()
            {
                Name = "MarketplaceQuality.Targets",
                ValueType = SettingValueType.ShortText,
                GroupName = "MarketplaceQuality|General",
                IsDictionary = true,
                AllowedValues = ["Catalog Publishing"],
            };

            public static IEnumerable<SettingDescriptor> AllGeneralSettings
            {
                get
                {
                    yield return MarketplaceQualityTargets;
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
