using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
//using Permissions = VirtoCommerce.MarketplaceQuality.Core.ModuleConstants.Security.Permissions;

namespace VirtoCommerce.MarketplaceQuality.Web.Controllers.Api;

[Authorize]
[Route("api/marketplace-quality")]
public class MarketplaceQualityController : Controller
{
    // GET: api/marketplace-quality
    // /// <summary>
    // /// Get message
    // /// </summary>
    // /// <remarks>Return "Hello world!" message</remarks>
    //[HttpGet]
    //[Route("")]
    //[Authorize(Permissions.Read)]
    //public ActionResult<string> Get()
    //{
    //    return Ok(new { result = "Hello world!" });
    //}
}
