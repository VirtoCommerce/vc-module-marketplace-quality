// Call this to register your module to main application
var moduleName = 'VirtoCommerce.MarketplaceQuality';

if (AppDependencies !== undefined) {
    AppDependencies.push(moduleName);
}

angular.module(moduleName, [])
    .config(['$stateProvider',
        function ($stateProvider) {
            //$stateProvider
            //    .state('workspace.MarketplaceQualityState', {
            //        url: '/marketplace-quality',
            //        templateUrl: '$(Platform)/Scripts/common/templates/home.tpl.html',
            //        controller: [
            //            'platformWebApp.bladeNavigationService',
            //            function (bladeNavigationService) {
            //                var newBlade = {
            //                    id: 'blade1',
            //                    controller: 'VirtoCommerce.MarketplaceQuality.helloWorldController',
            //                    template: 'Modules/$(VirtoCommerce.MarketplaceQuality)/Scripts/blades/hello-world.html',
            //                    isClosingDisabled: true,
            //                };
            //                bladeNavigationService.showBlade(newBlade);
            //            }
            //        ]
            //    });
        }
    ])
    .run(['$state', 'virtoCommerce.catalogQuality.qualityDataTypes',
        function ($state, qualityDataTypes) {

            // Seller product quality scoring entity type registration
            qualityDataTypes.addType({
                caption: 'quality-data-entity-types.seller-product',
                value: 'VirtoCommerce.MarketplaceVendorModule.Core.Domains.SellerProduct'
            });

            // Seller product quality scoring entity type registration
            qualityDataTypes.addType({
                caption: 'quality-data-entity-types.seller-offer',
                value: 'VirtoCommerce.MarketplaceVendorModule.Core.Domains.Offer'
            });
        }
    ]);
