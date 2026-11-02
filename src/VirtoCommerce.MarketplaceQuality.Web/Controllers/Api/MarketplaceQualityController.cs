using System;
using System.Threading.Tasks;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using VirtoCommerce.CatalogQuality.Core.Common;
using VirtoCommerce.MarketplaceQuality.Core.PushNotifications;
using VirtoCommerce.MarketplaceQuality.Data.Commands;
using VirtoCommerce.MarketplaceQuality.Data.Queries;
using VirtoCommerce.MarketplaceVendorModule.Data.Authorization;
using Permissions = VirtoCommerce.CatalogQuality.Core.ModuleConstants.Security.Permissions;

namespace VirtoCommerce.MarketplaceQuality.Web.Controllers.Api;

[Authorize]
[Route("api/vcmp/quality")]
public class MarketplaceQualityController : Controller
{
    private const string BearerPrefix = "Bearer ";

    private readonly IMediator _mediator;
    private readonly IAuthorizationService _authorizationService;

    public MarketplaceQualityController(
        IMediator mediator,
        IAuthorizationService authorizationService
        )
    {
        _mediator = mediator;
        _authorizationService = authorizationService;
    }

    /// <summary>
    /// Start scoring entities of one type by their AI quality expert.
    /// </summary>
    /// <remarks>
    /// The run is queued and the request returns at once with the run's progress notification, whose id is the run id.
    /// The expert gets the entities in batches and saves the evaluations itself. The progress notification is sent
    /// again after each batch, and a final notification with the same run id is sent when the run is over.
    /// Entities already being scored by another run are left out of this one.
    /// </remarks>
    [HttpPost]
    [Route("scoring")]
    [ProducesResponseType<QualityScoringPushNotification>(StatusCodes.Status202Accepted)]
    public async Task<ActionResult<QualityScoringPushNotification>> RunScoring([FromBody] RunQualityScoringCommand command)
    {
        var authorizationResult = await _authorizationService.AuthorizeAsync(User, command, new SellerAuthorizationRequirement(Permissions.Update));
        if (!authorizationResult.Succeeded)
        {
            return Forbid();
        }

        var authorization = Request.Headers.Authorization.ToString();
        if (!authorization.StartsWith(BearerPrefix, StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest("Quality scoring requires a bearer token");
        }

        command.Authorization = authorization;

        var result = await _mediator.Send(command);

        return Accepted(result);
    }

    /// <summary>
    /// Get the scoring runs of the current seller that are queued or running.
    /// </summary>
    /// <remarks>
    /// Returns the progress notification of each run, as last sent.
    /// </remarks>
    [HttpGet]
    [Route("scoring/running")]
    [Authorize(Permissions.Update)]
    public async Task<ActionResult<QualityScoringPushNotification[]>> GetRunningScorings()
    {
        var query = ExType<GetQualityScoringRunsQuery>.New();

        // The seller authorization handler sets the seller id of a seller user; the runs are found by it
        var authorizationResult = await _authorizationService.AuthorizeAsync(User, query, new SellerAuthorizationRequirement(Permissions.Update));
        if (!authorizationResult.Succeeded)
        {
            return Forbid();
        }

        var result = await _mediator.Send(query);

        return Ok(result);
    }
}
