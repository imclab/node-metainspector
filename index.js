var util = require('util'),
	request = require('request'),
	events = require('events'),
	cheerio = require('cheerio'),
	URI = require('uri-js');

var _my = null;

var debug
if (/\bmetainspector\b/.test(process.env.NODE_DEBUG)) {
  debug = function() {
    console.error('METAINSPECTOR %s', util.format.apply(util, arguments))
  }
} else {
  debug = function() {}
}

var MetaInspector = function(url){
	this.url = URI.normalize(withDefaultScheme(url));
	_my = {};
	
	this.parsedUrl = URI.parse(this.url);
	this.scheme = this.parsedUrl.scheme;
	this.host = this.parsedUrl.host;
	this.rootUrl = this.scheme + "://" + this.host;
};

MetaInspector.prototype = new events.EventEmitter;

module.exports = MetaInspector;

MetaInspector.prototype.fetch = function(){
	var self = this;

	request({uri : this.url}, function(error, response, body){
		if(!error && response.statusCode == 200){
			self.document = body
			self.parsedDocument = cheerio.load(body);
			self.response = response;

			initAllProperties.apply(self);

			self.emit("fetch");
		}
		else{
			self.emit("error", error);
		}
	});
};

function initAllProperties()
{
	// title of the page, as string
	this.title = getTitle.bind(this);

	// array of strings, with every link found on the page
	this.links = getLinks.bind(this);

	// meta description, as string
	this.metaDescription = getMetaDescription.bind(this);

	// returns the meta description, or the first long paragraph if no meta description is found
	this.description = getDescription.bind(this);

	// Most relevant image, if defined with og:image
	this.image = getImage.bind(this);

	// Get rss or atom links in meta data fields as array
	this.feeds = getFeeds.bind(this);

	// opengraph title
	this.ogTitle = getOgTitle.bind(this);
}

function getTitle()
{
	debug("Parsing page title");

	if(_my.title === undefined)
	{
		_my.title = this.parsedDocument('title').text();
	}
	 
	return _my.title;
}

function getOgTitle()
{
	debug("Parsing page Open Graph title");

	if(_my.ogTitle === undefined)
	{
		_my.ogTitle = this.parsedDocument("meta[property='og:title']").attr("content");
	}
	 
	return _my.ogTitle;
}

function getLinks()
{
	debug("Parsing page links");

	var self = this;

	if(_my.links === undefined)
	{
		_my.links = self.parsedDocument('a').map(function(i ,elem){
			return self.parsedDocument(this).attr('href');
		});
	}

	return _my.links;
}

function getDescription()
{
	debug("Parsing page description based on meta description or secondary description");
	return getMetaDescription.apply(this) || getSecondaryDescription.apply(this);
}

function getMetaDescription()
{
	debug("Parsing page description based on meta elements");

	if(_my.metaDescription === undefined)
	{
		_my.metaDescription = this.parsedDocument("meta[name='description']").attr("content");
	}

	return _my.metaDescription;
}

function getSecondaryDescription()
{
	debug("Parsing page secondary description");

	var self = this;

	if(_my.metaDescription === undefined)
	{
		var minimum_p_length = 120;

		self.parsedDocument("p").each(function(i, elem){
			if(_my.metaDescription !== undefined) return;

			var text = self.parsedDocument(this).text();
			
			// If we found a paragraph with more than
			if(text.length >= minimum_p_length)
			{
				_my.metaDescription = text;
			}
		});
	}

	return _my.metaDescription;
}

function getImage()
{
	debug("Parsing page image based on the Open Graph image");

	if(_my.metaImage === undefined)
	{
		_my.metaImage = this.parsedDocument("meta[property='og:image']").attr("content");
	}

	return _my.metaImage;
}

function getFeeds()
{
	debug("Parsing page feeds based on rss or atom feeds");

	if(_my.feeds === undefined)
	{
		_my.feeds = parseFeeds.apply(this, ["rss"]) || parseFeeds.apply(this, ["atom"])
	}

	return _my.feeds;
}

function parseFeeds(format)
{
	var self = this;

	var feeds = this.parsedDocument("link[type='application/" + format + "+xml']").map(function(i ,elem){
		return self.parsedDocument(this).attr('href');
	});

	return feeds;
}

function withDefaultScheme(url){
	return URI.parse(url).scheme ? url : "http://" + url;
};