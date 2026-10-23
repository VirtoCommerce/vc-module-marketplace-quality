using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace VirtoCommerce.MarketplaceQuality.Web.Controllers.Api;

[Authorize]
[Route("api/vcmp/quality")]
public class MarketplaceQualityController : Controller
{
    private readonly IMediator _mediator;

    public MarketplaceQualityController(IMediator mediator)
    {
        _mediator = mediator;
    }

    // /// <summary>
    // /// Get names of quality targets available on the marketplace
    // /// </summary>
    //[HttpGet]
    //[Route("target/names")]
    //[Authorize(Permissions.Read)]
    //public async Task<ActionResult<IList<string>>> GetTargetNames()
    //{
    //    var query = ExType<GetTargetNamesQuery>.New();
    //    var result = await _mediator.Send(query);
    //    return Ok(result);
    //}
}
